const jwt = require("jsonwebtoken");
const db = require("../config/db");

module.exports = async function (req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header) return res.status(401).json({ success: false, message: "No token provided" });

        const token = header.replace("Bearer ", "").trim();
        if (!token) return res.status(401).json({ success: false, message: "Invalid token" });

        // Decode token and get user ID
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Fetch user from DB
        const [rows] = await db.query(
            "SELECT id, is_admin FROM users WHERE id = ? LIMIT 1",
            [userId]
        );

        if (rows.length === 0)
            return res.status(401).json({ success: false, message: "User not found" });

        const user = rows[0];

        // Check admin flag
        if (user.is_admin !== 1) {
            return res.status(403).json({ success: false, message: "Forbidden: Not an admin" });
        }

        // Attach user to request
        req.admin = user;
        next();

    } catch (err) {
        console.log("ADMIN AUTH ERROR:", err);
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
};
