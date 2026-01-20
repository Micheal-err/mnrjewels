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
    admin: user.is_admin ,   // FIXED
    provider: "google"
  })
).toString("base64");

res.cookie("token", jwtToken, {
  httpOnly: true,
  sameSite: "lax",
  secure: false, // true on HTTPS
  maxAge: 7 * 24 * 60 * 60 * 1000
});


    res.redirect(`/account?token=${token}&user=${userPayload}`);
  }
);

module.exports = router;
