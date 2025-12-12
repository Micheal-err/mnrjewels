const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Step 1: Google Login Redirect
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Step 2: Google Callback
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/account' }),
  (req, res) => {
    const user = req.user; // coming from passport.deserializeUser

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userPayload = Buffer.from(
  JSON.stringify({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    admin: user.is_admin === 1,   // FIXED
    provider: "google"
  })
).toString("base64");


    res.redirect(`/account/social-login-success?token=${token}&user=${userPayload}`);
  }
);

module.exports = router;
