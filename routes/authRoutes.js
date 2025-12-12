// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const jwt = require("jsonwebtoken");

// STEP 1: Start Google login
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// STEP 2: Google callback
router.get("/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    async (req, res) => {

        const user = req.user;

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        const userPayload = Buffer.from(JSON.stringify({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            provider: "google",
        })).toString("base64");

        res.redirect(`/account/social-login-success?token=${token}&user=${userPayload}`);
    }
);
router.get("/check", (req, res) => {
    if (req.session.user) {
        return res.json({ loggedIn: true, user: req.session.user });
    }
    res.json({ loggedIn: false });
});

module.exports = router;
