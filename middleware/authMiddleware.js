const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.redirect("/account");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, is_admin }

    next();
  } catch (err) {
    return res.redirect("/account");
  }
};
