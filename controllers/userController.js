const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/* ============================================================
   REGISTER USER
============================================================ */
exports.registerUser = async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const [exists] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (exists.length > 0)
      return res.status(400).json({ success: false, message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (first_name, last_name, email, password, is_admin) VALUES (?, ?, ?, ?, 0)",
      [first_name, last_name, email, hashed]
    );

    const user = {
      id: result.insertId,
      first_name,
      last_name,
      email,
      admin: 0
    };

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      message: "Account created successfully",
      token,
      user
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


/* ============================================================
   LOGIN USER
============================================================ */
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: "Email & password required" });
    }

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0)
      return res.status(400).json({ success: false, message: "Invalid email" });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match)
      return res.status(400).json({ success: false, message: "Incorrect password" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        admin: user.is_admin === 1

      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   GET ALL USERS
============================================================ */
exports.getUsers = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, first_name, last_name, email FROM users");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================================
   GET USER BY ID
============================================================ */
exports.getUserById = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.json(rows[0]);

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================================
   UPDATE USER — PREVENT BLANK FIELDS
============================================================ */
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { first_name, last_name, email } = req.body;

    // Reject blank values
    if (!first_name || !last_name || !email)
      return res.status(400).json({ success: false, message: "All fields are required" });

    // Check if email is taken by another user
    const [emailCheck] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, userId]
    );

    if (emailCheck.length > 0)
      return res.status(400).json({ success: false, message: "Email already exists" });

    await db.query(
      "UPDATE users SET first_name=?, last_name=?, email=? WHERE id=?",
      [first_name, last_name, email, userId]
    );

    return res.json({ success: true, message: "User updated successfully" });

  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   DELETE USER
============================================================ */
exports.deleteUser = async (req, res) => {
  try {
    await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================================
   CHANGE PASSWORD
============================================================ */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { old_password, new_password } = req.body;

    if (!old_password?.trim() || !new_password?.trim()) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const [rows] = await db.query("SELECT password FROM users WHERE id=?", [userId]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const match = await bcrypt.compare(old_password, rows[0].password);
    if (!match)
      return res.status(400).json({ success: false, message: "Old password is incorrect" });

    const hashed = await bcrypt.hash(new_password, 10);

    await db.query("UPDATE users SET password=? WHERE id=?", [hashed, userId]);

    return res.json({ success: true, message: "Password updated successfully" });

  } catch (err) {
    console.log("PASSWORD ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
