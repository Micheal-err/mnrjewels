// routes/contactRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db"); // mysql2 pool or connection

// POST /contact  -> public contact form endpoint
router.post("/", async (req, res) => {
  try {
    // basic logging
    console.log("Incoming contact POST:", req.body);

    const { name, email, phone, message } = req.body || {};

    // basic server-side validation (mirrors frontend)
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    // phone optional; if provided validate digits length
    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Phone must be 10 digits" });
    }

    // save into DB
    await db.query(
      `INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)`,
      [name.trim(), email.trim(), phone ? phone.trim() : null, message.trim()]
    );

    // Respond clearly
    return res.json({ success: true, message: "Message saved" });

  } catch (err) {
    console.error("Contact route error:", err);
    // return detailed message for debugging; in production you may hide the error
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

router.post("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { status, name, email, phone, message } = req.body;

  // Mark read/unread → ONLY update `status`
  if (status !== undefined && !name && !email && !phone && !message) {
    await db.query("UPDATE contact_messages SET status=? WHERE id=?", [status, id]);
    return res.json({ success: true });
  }

  // Edit modal → update ALL fields
  await db.query(
    "UPDATE contact_messages SET name=?, email=?, phone=?, message=?, status=? WHERE id=?",
    [name, email, phone, message, status, id]
  );

  res.json({ success: true });
});


module.exports = router;
