const db = require("../config/db");

exports.getAvailableCoupons = async (req, res) => {
  const userId = req.user.id;

  try {
    const [coupons] = await db.query(`
      SELECT c.id, c.code, c.type, c.value, c.min_order, c.max_discount
      FROM coupons c
      WHERE c.active = 1
      AND NOW() BETWEEN c.start_date AND c.end_date
      AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
      AND NOT EXISTS (
        SELECT 1 FROM coupon_usages cu
        WHERE cu.coupon_id = c.id
        AND cu.user_id = ?
      )
      ORDER BY c.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      coupons
    });

  } catch (err) {
    console.error("COUPON FETCH ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.applyCoupon = async (req, res) => {
  const userId = req.user.id;
  const { code, cartTotal } = req.body;

  if (!code || !cartTotal) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    const [[coupon]] = await db.query(`
      SELECT * FROM coupons
      WHERE code = ?
      AND active = 1
      AND NOW() BETWEEN start_date AND end_date
    `, [code]);

    if (!coupon) {
      return res.status(400).json({ message: "Invalid or expired coupon" });
    }

    // Check if user already used coupon
    const [[used]] = await db.query(`
      SELECT id FROM coupon_usages
      WHERE coupon_id = ? AND user_id = ?
    `, [coupon.id, userId]);

    if (used) {
      return res.status(400).json({ message: "Coupon already used" });
    }

    // Minimum order check
    if (cartTotal < coupon.min_order) {
      return res.status(400).json({
        message: `Minimum order ₹${coupon.min_order} required`
      });
    }

    // Calculate discount
    let discount = 0;

    if (coupon.type === "percent") {
      discount = (cartTotal * coupon.value) / 100;
      if (coupon.max_discount) {
        discount = Math.min(discount, coupon.max_discount);
      }
    } else {
      discount = coupon.value;
    }

    const finalAmount = Math.max(cartTotal - discount, 0);

    res.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount,
        finalAmount
      }
    });

  } catch (err) {
    console.error("COUPON APPLY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
