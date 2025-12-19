const jwt = require("jsonwebtoken");
const db = require("../config/db");

module.exports = async function adminAuth(req, res, next) {
  try {
 
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.redirect("/account");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.query(
      "SELECT id, is_admin FROM users WHERE id = ?",
      [decoded.id]
    );

    if (!rows.length || Number(rows[0].is_admin) !== 1) {
      return res.redirect("/account");
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error("🔥 ADMIN AUTH ERROR:", err.message);
    return res.redirect("/account");
  }
};
