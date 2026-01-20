const express = require("express");
const router = express.Router();
const db = require("../config/db");
const sendMail = require("../utils/mailer");
const newsletterWelcomeEmail = require("../emails/newsletterWelcome");

router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.json({ success: false, message: "Email required" });
    }

    const [exists] = await db.query(
      "SELECT id FROM newsletter_subscribers WHERE email = ?",
      [email]
    );

    if (exists.length) {
      return res.json({
        success: false,
        message: "You are already subscribed"
      });
    }

    await db.query(
      "INSERT INTO newsletter_subscribers (email) VALUES (?)",
      [email]
    );

    // 🔥 SEND EMAIL (non-blocking is optional)
    await sendMail({
      to: email,
      subject: "Welcome to M&R Jewels Newsletter 💎",
      html: newsletterWelcomeEmail()
    });

    res.json({
      success: true,
      message: "Subscribed successfully. Check your email ✨"
    });

  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Something went wrong"
    });
  }
});

module.exports = router;
