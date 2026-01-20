const db = require("../config/db");

module.exports = async function adminAuth(req, res, next) {
  try {
    // Passport / express-session user id
    const userId = req.session?.passport?.user;

    if (!userId) {
      return res.redirect("/account");
    }

    const [rows] = await db.query(
      "SELECT id, is_admin FROM users WHERE id = ?",
      [userId]
    );

    if (!rows.length || rows[0].is_admin !== 1) {
      return res.redirect("/account");
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error("🔥 ADMIN AUTH ERROR:", err.message);
    return res.redirect("/account");
  }
};
