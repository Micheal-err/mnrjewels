const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  const headerToken = req.headers.authorization?.split(" ")[1];
  const cookieToken = req.cookies?.token;

  const token = headerToken || cookieToken;

  if (!token) {
    // If page request → redirect
    if (req.accepts("html")) {
      return res.redirect("/login");
    }

    // API request
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
    next();
  } catch {
    if (req.accepts("html")) {
      return res.redirect("/login");
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};
