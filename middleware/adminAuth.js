module.exports = async function adminAuth(req, res, next) {
  try {
    console.log("COOKIES:", req.cookies);

    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "");

    console.log("TOKEN:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("DECODED JWT:", decoded);

    const [rows] = await db.query(
      "SELECT id, is_admin FROM users WHERE id = ?",
      [decoded.id]
    );

    console.log("DB USER:", rows);

    if (!rows.length || Number(rows[0].is_admin) !== 1) {
      console.log("❌ NOT ADMIN");
      return res.redirect("/account");
    }

    console.log("✅ ADMIN AUTH PASSED");
    req.user = rows[0];
    next();
  } catch (err) {
    console.error("ADMIN AUTH ERROR:", err.message);
    return res.redirect("/account");
  }
};
