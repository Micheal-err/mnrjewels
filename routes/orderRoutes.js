const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/authMiddleware");

/**
 * CREATE ORDER
 */
router.post("/", auth, async (req, res) => {
  const {
    items,
    shipping_address,
    billing_address,
    payment_method
  } = req.body;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ Create order
    const [orderResult] = await conn.query(
      `
      INSERT INTO orders
      (order_number, user_id, subtotal, payment_status, status, payment_method)
      VALUES (?, ?, ?, 'unpaid', 'pending', ?)
      `,
      [
        `ORD-${Date.now()}`,
        req.user.id,
        items.reduce((sum, i) => sum + i.price * i.qty, 0),
        payment_method
      ]
    );

    const orderId = orderResult.insertId;

    // 2️⃣ Insert order items
    for (const item of items) {
      await conn.query(
        `
        INSERT INTO order_items
        (order_id, product_id, variant_id, product_name, sku, price, quantity, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.sku,
          item.price,
          item.qty,
          item.price * item.qty
        ]
      );
    }

    // 3️⃣ Addresses
    const insertAddress = async (type, a) => {
      await conn.query(
        `
        INSERT INTO order_addresses
        (order_id, type, name, phone, email, address_line1, city, state, postal_code, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId, type, a.name, a.phone, a.email,
          a.address_line1, a.city, a.state, a.postal_code, a.country
        ]
      );
    };

    await insertAddress("shipping", shipping_address);
    await insertAddress("billing", billing_address);

    // 4️⃣ Status history
    await conn.query(
      `
      INSERT INTO order_status_history
      (order_id, status, changed_by)
      VALUES (?, 'pending', 'user')
      `,
      [orderId]
    );

    await conn.commit();
    res.json({ success: true, order_id: orderId });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  } finally {
    conn.release();
  }
});


//get my orders
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

//get single order
router.get("/:id", auth, async (req, res) => {
  const orderId = req.params.id;

  const [[order]] = await db.query(
    `SELECT * FROM orders WHERE id=? AND user_id=?`,
    [orderId, req.user.id]
  );

  if (!order) return res.status(404).json({ error: "Not found" });

  const [items] = await db.query(
    `SELECT * FROM order_items WHERE order_id=?`,
    [orderId]
  );

  res.json({ order, items });
});



//cancel order 
router.post("/:id/cancel", auth, async (req, res) => {
  const orderId = req.params.id;

  const [[order]] = await db.query(
    `SELECT status FROM orders WHERE id=? AND user_id=?`,
    [orderId, req.user.id]
  );

  if (!order || !["pending", "confirmed"].includes(order.status)) {
    return res.status(400).json({ error: "Cannot cancel order" });
  }

  await db.query(
    `UPDATE orders SET status='cancelled' WHERE id=?`,
    [orderId]
  );

  res.json({ success: true });
});




router.get("/order-success/:id", async (req, res) => {
  const orderId = req.params.id;

  const [[order]] = await db.query(`
    SELECT
      id,
      order_number,
      status,
      payment_method,
      total,
      created_at
    FROM orders
    WHERE id = ?
  `, [orderId]);

  const [[address]] = await db.query(`
    SELECT
      name,
      email,
      phone,
      address_line1,
      city,
      state,
      pincode,
      country
    FROM order_addresses
    WHERE order_id = ?
    LIMIT 1
  `, [orderId]);

  const [items] = await db.query(`
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
  `, [orderId]);

  res.render("pages/order-success", {
    order,
    address,
    items
  });
});

module.exports = router;
