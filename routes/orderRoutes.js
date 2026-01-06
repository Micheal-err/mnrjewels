const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/authMiddleware");

/**
 * CREATE ORDER (WITH COUPON SUPPORT)
 */
router.post("/", auth, async (req, res) => {
  const {
    items,
    shipping_address,
    billing_address,
    payment_method,
    coupon_code
  } = req.body;

  const userId = req.user.id;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Invalid order items" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* =======================
       SAFE SUBTOTAL
    ======================= */
    const subtotal = items.reduce((sum, i) => {
      const price = Number(i.price);
      const qty = Number(i.qty ?? i.quantity);

      if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) {
        throw new Error("Invalid item price or quantity");
      }

      return sum + price * qty;
    }, 0);

    let coupon = null;
    let discount = 0;

    /* =======================
       COUPON VALIDATION
    ======================= */
    if (coupon_code) {
      const [[c]] = await conn.query(
        `
        SELECT *
        FROM coupons
        WHERE code = ?
          AND active = 1
          AND (start_date IS NULL OR start_date <= NOW())
          AND (end_date IS NULL OR end_date >= NOW())
          AND (usage_limit IS NULL OR used_count < usage_limit)
        `,
        [coupon_code]
      );

      if (!c) throw new Error("Invalid or expired coupon");

      const [[used]] = await conn.query(
        `
        SELECT id
        FROM coupon_usages
        WHERE coupon_id = ? AND user_id = ?
        `,
        [c.id, userId]
      );

      if (used) throw new Error("Coupon already used");

      if (subtotal < Number(c.min_order || 0)) {
        throw new Error(`Minimum order ₹${c.min_order} required`);
      }

      if (c.type === "percent") {
        discount = (subtotal * Number(c.value)) / 100;
        if (c.max_discount) {
          discount = Math.min(discount, Number(c.max_discount));
        }
      } else {
        discount = Number(c.value);
      }

      if (!Number.isFinite(discount) || discount < 0) discount = 0;

      coupon = c;
    }

    const grandTotal = Math.max(subtotal - discount, 0);

    /* =======================
       CREATE ORDER
    ======================= */
    const [orderResult] = await conn.query(
      `
      INSERT INTO orders
      (order_number, user_id, subtotal, discount, grand_total, coupon_id, payment_status, status, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?)
      `,
      [
        `ORD-${Date.now()}`,
        userId,
        subtotal,
        discount,
        grandTotal,
        coupon ? coupon.id : null,
        payment_method || "cod"
      ]
    );

    const orderId = orderResult.insertId;

    /* =======================
       ORDER ITEMS
    ======================= */
    for (const item of items) {
      const qty = Number(item.qty ?? item.quantity);
      const price = Number(item.price);

      await conn.query(
        `
        INSERT INTO order_items
        (order_id, product_id, variant_id, product_name, sku, price, quantity, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.product_id,
          item.variant_id || null,
          item.product_name,
          item.sku || null,
          price,
          qty,
          price * qty
        ]
      );
    }

    /* =======================
       ADDRESSES
    ======================= */
    const insertAddress = async (type, a) => {
  if (!a?.name || !a?.phone || !(a.pincode || a.postal_code)) {
    throw new Error(`${type} address missing pincode`);
  }

  await conn.query(
    `
    INSERT INTO order_addresses
    (order_id, type, name, phone, email, address_line1, city, state, pincode, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      orderId,
      type,
      a.name,
      a.phone,
      a.email || null,
      a.address_line1,
      a.city || null,
      a.state || null,
      a.pincode || a.postal_code, // ✅ FIX
      a.country || "India"
    ]
  );
};


    await insertAddress("shipping", shipping_address);
    await insertAddress("billing", billing_address);

    /* =======================
       COUPON LOCK
    ======================= */
    if (coupon) {
      await conn.query(
        `
        INSERT INTO coupon_usages (coupon_id, user_id, order_id)
        VALUES (?, ?, ?)
        `,
        [coupon.id, userId, orderId]
      );

      await conn.query(
        `
        UPDATE coupons
        SET used_count = used_count + 1
        WHERE id = ?
        `,
        [coupon.id]
      );
    }

    /* =======================
       STATUS HISTORY
    ======================= */
    await conn.query(
      `
      INSERT INTO order_status_history (order_id, status, changed_by)
      VALUES (?, 'pending', 'user')
      `,
      [orderId]
    );

    await conn.commit();

    res.json({
      success: true,
      order_id: orderId,
      subtotal,
      discount,
      grand_total: grandTotal
    });

  } catch (err) {
    await conn.rollback();
    console.error("ORDER ERROR:", err.message);
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* =======================
   GET MY ORDERS
======================= */
router.get("/", auth, async (req, res) => {
  const [orders] = await db.query(
    `
    SELECT id, order_number, grand_total, status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
    [req.user.id]
  );

  res.json(orders);
});

/* =======================
   GET SINGLE ORDER
======================= */
router.get("/:id", auth, async (req, res) => {
  const orderId = req.params.id;

  const [[order]] = await db.query(
    `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
    [orderId, req.user.id]
  );

  if (!order) return res.status(404).json({ error: "Not found" });

  const [items] = await db.query(
    `SELECT * FROM order_items WHERE order_id = ?`,
    [orderId]
  );

  res.json({ order, items });
});

/* =======================
   CANCEL ORDER
======================= */
router.post("/:id/cancel", auth, async (req, res) => {
  const orderId = req.params.id;

  const [[order]] = await db.query(
    `SELECT status FROM orders WHERE id = ? AND user_id = ?`,
    [orderId, req.user.id]
  );

  if (!order || !["pending", "confirmed"].includes(order.status)) {
    return res.status(400).json({ error: "Cannot cancel order" });
  }

  await db.query(
    `UPDATE orders SET status = 'cancelled' WHERE id = ?`,
    [orderId]
  );

  res.json({ success: true });
});

/* =======================
   ORDER SUCCESS PAGE
======================= */
router.get("/order-success/:id", async (req, res) => {
  const orderId = req.params.id;

  const [[order]] = await db.query(
    `
    SELECT id, order_number, status, payment_method, subtotal, discount, grand_total, created_at
    FROM orders
    WHERE id = ?
    `,
    [orderId]
  );

  const [[address]] = await db.query(
    `
    SELECT name, email, phone, address_line1, city, state, pincode, country
    FROM order_addresses
    WHERE order_id = ?
    LIMIT 1
    `,
    [orderId]
  );

  const [items] = await db.query(
    `
    SELECT
      p.name AS product_name,
      v.sku,
      oi.quantity,
      oi.price,
      (oi.price * oi.quantity) AS total
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_variants v ON v.id = oi.variant_id
    WHERE oi.order_id = ?
    `,
    [orderId]
  );

  res.render("pages/order-success", { order, address, items });
});

module.exports = router;
