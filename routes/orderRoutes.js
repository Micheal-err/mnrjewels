const express = require("express");
const router = express.Router();
const db = require("../config/db");

// auth middleware (must already exist)
const authUser = require("../middleware/authMiddleware");

/* =====================================================
   CHECK IF USER HAS PURCHASED A PRODUCT
   GET /api/orders/has-purchased/:productId
===================================================== */
router.get("/has-purchased/:productId", authUser, async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT oi.id
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ?
        AND oi.product_id = ?
        AND o.status = 'completed'
      LIMIT 1
    `, [userId, productId]);

    res.json({ purchased: rows.length > 0 });

  } catch (err) {
    console.error("has-purchased error:", err);
    res.status(500).json({ purchased: false });
  }
});

module.exports = router;
