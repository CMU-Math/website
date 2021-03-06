const router = require('express').Router(),
      auth = require('../config/auth'),
      handler = require('../utils/handler');

const User = require('../database/user'),
      Student = require('../database/student'),
      Team = require('../database/team');

router.post('/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    handler(false, 'Please fill out all fields.', 400)(req, res);
  } else {
    User.findOne({ email }, (err, user) => {
      if (err) handler(false, 'Failed to find email.', 503)(req, res);
      else if (user) handler(false, 'Email exists already.', 400)(req, res);
      else {
        const user = Object.assign(new User(), { email, password });
        user.save(err => {
          if (err) {
            handler(false, 'Failed to save user.', 503)(req, res);
          } else {
            handler(true, 'User signed up successfully.', 200, {
              token: auth.signJWT(email, user._id)
            })(req, res);
          }
        });
      }
    });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    handler(false, 'Please fill out all fields.', 400)(req, res);
  } else {
    User.findOne({ email }, (err, user) => {
      if (err) {
        handler(false, 'Database failed to find email.', 503)(req, res);
      } else if (!user) {
        handler(false, 'Account does not exist.', 400)(req, res);
      } else {
        user.checkPassword(password, (err, result) => {
          if (err) {
            handler(false, 'Database failed to authenticate.', 503)(req, res);
          } else {
            return result.authenticated ?
              handler(true, 'User authenticated.', 200, {
                token: auth.signJWT(user.email, user._id, user.admin)
              })(req, res) :
              handler(false, 'Authentication failed.', 401)(req, res);
          }
        });
      }
    });
  }
});

router.post('/password', auth.verifyJWT, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  console.log(oldPassword, newPassword);
  req.user.checkPassword(oldPassword, (err, result) => {
    if (err) {
      handler(false, 'Database failed to authenticate.', 503)(req, res);
    } else if (result.authenticated) {
      req.user.password = newPassword;
      req.user.save(err => {
        if (err)
          handler(false, 'Database failed to save new password.', 503)(req, res);
        else {
          handler(true, 'Successfully updated password.', 200, {
            token: auth.signJWT(req.user.email, req.user._id, req.user.admin)
          })(req, res);
        }
      });
    } else {
      handler(false, 'Incorrect password.', 401)(req, res);
    }
  });
});

router.post('/reset', auth.verifyJWT, (req, res) => {
  const email = req.user.email;
  User.findOne({ email }, (err, user) => {
    if (err) {
      handler(false, 'Database failed to find email.', 503)(req, res);
    } else if (!user) {
      handler(false, 'Account does not exist.', 400)(req, res);
    } else {
      if (!user.admin) {
        handler(false, 'Admin access required.', 401)(req, res);
      } else {
        User.update({}, {
          teams: [], // empty out teams
          registrationWhitelist: false // set whitelist to false
        }, {}, (err, numAffected) => {
          if (err) {
            handler(false, 'Reset failed in some way.', 503)(req, res);
          } else {
            // delete teams and students
            Student.remove({}, err => {
              if (err) {
                handler(false, 'Remove of students failed in some way.', 503)(req, res);
              } else {
                Team.remove({}, err => {
                  if (err) {
                    handler(false, 'Remove of teams failed in some way.', 503)(req, res);
                  } else {
                    handler(true, 'Successfully resetted database.', 200)(req, res);
                  }
                });
              }
            })
          }
        });
      }
    }
  });
});

router.get('/registration_status', (req, res) => {
  handler(true, 'Successfully retrieved registration status.', 200, {
    registration_status: process.env.REGISTRATION === 'true'
  })(req, res);
});


module.exports = router;
