const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/authMiddleware");

/* =====================================================
   GET USER ORDERS (FULL DETAILS – LATEST FIRST)
===================================================== */
router.get("/userorders", auth, async (req, res) => {
  const userId = req.user.id;

  try {
    /* ORDERS */
    const [orders] = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.created_at,
        o.status,
        o.payment_status,
        o.payment_method,
        o.subtotal,
        o.discount,
        o.grand_total,
        c.code AS coupon_code
      FROM orders o
      LEFT JOIN coupons c ON c.id = o.coupon_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [userId]);

    if (!orders.length) return res.json([]);

    const orderIds = orders.map(o => o.id);

    /* ITEMS */
    const [items] = await db.query(`
      SELECT
        oi.order_id,
        oi.quantity,
        oi.price,
        p.name AS product_name,
        p.image1 AS product_image,
        pv.finish,
        pv.length_size
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      WHERE oi.order_id IN (?)
    `, [orderIds]);

    /* ADDRESSES (BILLING + SHIPPING) */
    const [addresses] = await db.query(`
      SELECT
        order_id,
        type,
        name,
        phone,
        email,
        address_line1,
        city,
        state,
        pincode,
        country
      FROM order_addresses
      WHERE order_id IN (?)
    `, [orderIds]);

    /* MERGE */
    const map = {};

   const now = Date.now();

orders.forEach(o => {
  const days =
    (now - new Date(o.created_at)) / (1000 * 60 * 60 * 24);

  map[o.id] = {
    ...o,
    items: [],
    shipping_address: null,
    billing_address: null,
    can_cancel: days <= 3 && ["pending","confirmed"].includes(o.status)
  };
});

    items.forEach(i => {
      map[i.order_id].items.push({
        product_name: i.product_name,
        product_image: i.product_image,
        variant: [i.finish, i.length_size].filter(Boolean).join(" / "),
        quantity: i.quantity,
        price: i.price
      });
    });

    addresses.forEach(a => {
      if (a.type === "shipping") map[a.order_id].shipping_address = a;
      if (a.type === "billing") map[a.order_id].billing_address = a;
    });

    res.json(Object.values(map));

  } catch (err) {
    console.error("USER ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

/* =====================================================
   CREATE ORDER (COUPON + BILLING + SHIPPING)
===================================================== */
router.post("/", auth, async (req, res) => {
  const { items, shipping_address, billing_address, payment_method, coupon_code } = req.body;
  const userId = req.user.id;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Invalid order items" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* SUBTOTAL */
    const subtotal = items.reduce((sum, i) => {
      const price = Number(i.price);
      const qty = Number(i.qty ?? i.quantity);
      if (!Number.isFinite(price) || qty <= 0) {
        throw new Error("Invalid item data");
      }
      return sum + price * qty;
    }, 0);

    let coupon = null;
    let discount = 0;

    /* COUPON */
    if (coupon_code) {
      const [[c]] = await conn.query(`
        SELECT *
        FROM coupons
        WHERE code=?
          AND active=1
          AND (start_date IS NULL OR start_date<=NOW())
          AND (end_date IS NULL OR end_date>=NOW())
          AND (usage_limit IS NULL OR used_count < usage_limit)
      `, [coupon_code]);

      if (!c) throw new Error("Invalid or expired coupon");

      const [[used]] = await conn.query(`
        SELECT id FROM coupon_usages
        WHERE coupon_id=? AND user_id=?
      `, [c.id, userId]);

      if (used) throw new Error("Coupon already used");

      if (subtotal < (c.min_order || 0)) {
        throw new Error(`Minimum order ₹${c.min_order}`);
      }

      discount = c.type === "percent"
        ? Math.min((subtotal * c.value) / 100, c.max_discount || Infinity)
        : c.value;

      coupon = c;
    }

    const grandTotal = Math.max(subtotal - discount, 0);

    /* ORDER */
    const [orderRes] = await conn.query(`
      INSERT INTO orders
      (order_number, user_id, subtotal, discount, grand_total, coupon_id, payment_status, status, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?)
    `, [
      `ORD-${Date.now()}`,
      userId,
      subtotal,
      discount,
      grandTotal,
      coupon ? coupon.id : null,
      payment_method || "razorpay"
    ]);

    const orderId = orderRes.insertId;

    /* ITEMS */
    for (const i of items) {
      const qty = Number(i.qty ?? i.quantity);
      await conn.query(`
        INSERT INTO order_items
        (order_id, product_id, variant_id, product_name, sku, price, quantity, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        i.product_id,
        i.variant_id || null,
        i.product_name,
        i.sku || null,
        i.price,
        qty,
        i.price * qty
      ]);
    }

    /* ADDRESSES */
    const insertAddress = async (type, a) => {
      if (!a?.name || !a?.phone || !a?.pincode) {
        throw new Error(`${type} address incomplete`);
      }

      await conn.query(`
        INSERT INTO order_addresses
        (order_id, type, name, phone, email, address_line1, city, state, pincode, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        type,
        a.name,
        a.phone,
        a.email || null,
        a.address_line1,
        a.city,
        a.state,
        a.pincode,
        a.country || "India"
      ]);
    };

    await insertAddress("shipping", shipping_address);
    await insertAddress("billing", billing_address);

    /* COUPON LOCK */
    if (coupon) {
      await conn.query(`
        INSERT INTO coupon_usages (coupon_id, user_id, order_id)
        VALUES (?, ?, ?)
      `, [coupon.id, userId, orderId]);

      await conn.query(`
        UPDATE coupons SET used_count = used_count + 1
        WHERE id=?
      `, [coupon.id]);
    }

    /* STATUS HISTORY */
    await conn.query(`
      INSERT INTO order_status_history (order_id, status, changed_by)
      VALUES (?, 'pending', 'user')
    `, [orderId]);

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
    console.error("ORDER CREATE ERROR:", err.message);
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* =====================================================
   CANCEL ORDER (USER – 3 DAY LIMIT + RESTOCK)
===================================================== */
router.post("/:id/cancel", auth, async (req, res) => {
  const orderId = req.params.id;
  const userId = req.user.id;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query(`
      SELECT status, created_at
      FROM orders
      WHERE id=? AND user_id=?
      FOR UPDATE
    `, [orderId, userId]);

    if (!order) throw new Error("Order not found");

    const days =
      (Date.now() - new Date(order.created_at)) / (1000 * 60 * 60 * 24);

    if (days > 3) throw new Error("Cancellation window expired");
    if (!["pending","confirmed"].includes(order.status)) {
      throw new Error("Order cannot be cancelled");
    }

    /* RESTOCK */
    const [items] = await conn.query(`
      SELECT variant_id, quantity
      FROM order_items
      WHERE order_id=?
    `, [orderId]);

    for (const i of items) {
      await conn.query(`
        UPDATE product_variants
        SET stock = stock + ?
        WHERE id=?
      `, [i.quantity, i.variant_id]);
    }

    /* UPDATE ORDER */
    await conn.query(`
      UPDATE orders SET status='cancelled'
      WHERE id=?
    `, [orderId]);

    await conn.query(`
      INSERT INTO order_status_history
      (order_id, status, changed_by)
      VALUES (?, 'cancelled', 'user')
    `, [orderId]);

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
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
