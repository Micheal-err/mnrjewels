const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/authMiddleware");

// GET AVAILABLE COUPONS (not used by user yet)
router.get("/available", auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, code, type, value, min_order
      FROM coupons
      WHERE active = 1
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
        AND id NOT IN (
          SELECT coupon_id FROM coupon_usages WHERE user_id = ?
        )
    `, [req.user.id]);

    res.json({ success: true, coupons: rows });
  } catch (err) {
    console.error("COUPON AVAILABLE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// APPLY COUPON
router.post("/apply", auth, async (req, res) => {
  const { code, cartTotal } = req.body;

  const [[coupon]] = await db.query(
    `SELECT * FROM coupons WHERE code=? AND active=1`,
    [code]
  );

  if (!coupon) {
    return res.status(400).json({ success: false, message: "Invalid coupon" });
  }

  if (cartTotal < coupon.min_order) {
    return res.status(400).json({
      success: false,
      message: `Minimum order ₹${coupon.min_order}`
    });
  }

  let discount =
    coupon.type === "percent"
      ? (cartTotal * coupon.value) / 100
      : coupon.value;

  if (coupon.max_discount) {
    discount = Math.min(discount, coupon.max_discount);
  }

  res.json({
    success: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount,
      finalAmount: cartTotal - discount
    }
  });
});

module.exports = router;
