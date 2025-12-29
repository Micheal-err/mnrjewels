const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

/* ======================================================
   🧾 CHECKOUT – CART REVIEW (READ ONLY, SAFE)
   ====================================================== */
router.get("/cart", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [items] = await db.query(`
      SELECT
        ci.id AS cart_id,
        ci.quantity,

        v.id AS variant_id,
        v.price,
        v.stock,
        v.finish,
        v.length_size,
        v.width,
        v.thickness,

        p.id AS product_id,
        p.name,
        p.image1
      FROM cart_items ci
      JOIN product_variants v ON v.id = ci.variant_id
      JOIN products p ON p.id = v.product_id
      WHERE ci.user_id = ?
    `, [userId]);

    if (!items.length) {
      return res.json({
        success: true,
        items: [],
        subtotal: 0,
        hasStockIssue: false
      });
    }

    let subtotal = 0;
    let hasStockIssue = false;

    const enrichedItems = items.map(i => {
      const inStock = i.stock >= i.quantity;
      if (!inStock) hasStockIssue = true;

      subtotal += i.price * i.quantity;

      return {
        ...i,
        inStock
      };
    });

    res.json({
      success: true,
      items: enrichedItems,
      subtotal,
      hasStockIssue
    });

  } catch (err) {
    console.error("CHECKOUT CART ERROR:", err);
    res.status(500).json({ success: false });
  }
});


/* ======================================================
   💵 CHECKOUT – CASH ON DELIVERY (STRICT VALIDATION)
   ====================================================== */
router.post("/cod", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { billing } = req.body;

  if (!billing || !billing.name || !billing.phone) {
    return res.status(400).json({
      success: false,
      message: "Invalid billing details"
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [cart] = await conn.query(`
      SELECT
        ci.quantity,
        v.id AS variant_id,
        v.price,
        v.stock,
        p.id AS product_id,
        p.name
      FROM cart_items ci
      JOIN product_variants v ON v.id = ci.variant_id
      JOIN products p ON p.id = v.product_id
      WHERE ci.user_id = ?
      FOR UPDATE
    `, [userId]);

    if (!cart.length) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
    }

    let subtotal = 0;

    for (const i of cart) {
      if (i.stock < i.quantity) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${i.name}`
        });
      }
      subtotal += i.price * i.quantity;
    }

    /* 1️⃣ CREATE ORDER */
    const [orderRes] = await conn.query(`
      INSERT INTO orders
      (user_id, total, payment_method, payment_status, status)
      VALUES (?, ?, 'cod', 'unpaid', 'pending')
    `, [userId, subtotal]);

    const orderId = orderRes.insertId;

    /* 2️⃣ ORDER ITEMS + STOCK UPDATE */
    for (const i of cart) {
      await conn.query(`
        INSERT INTO order_items
        (order_id, product_id, variant_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `, [orderId, i.product_id, i.variant_id, i.quantity, i.price]);

      await conn.query(`
        UPDATE product_variants
        SET stock = stock - ?
        WHERE id = ?
      `, [i.quantity, i.variant_id]);
    }

    /* 3️⃣ BILLING ADDRESS */
    await conn.query(`
      INSERT INTO order_addresses
      (order_id, type, name, phone, email, address_line1, city, state, pincode, country)
      VALUES (?, 'billing', ?, ?, ?, ?, ?, ?, ?, 'India')
    `, [
      orderId,
      billing.name,
      billing.phone,
      billing.email,
      billing.address,
      billing.city,
      billing.state,
      billing.pincode
    ]);

    /* 4️⃣ ORDER STATUS HISTORY */
    await conn.query(`
      INSERT INTO order_status_history
      (order_id, status, changed_by)
      VALUES (?, 'pending', 'system')
    `, [orderId]);

    /* 5️⃣ CLEAR CART */
    await conn.query(`DELETE FROM cart_items WHERE user_id = ?`, [userId]);

    await conn.commit();

    res.json({
      success: true,
      orderId
    });

  } catch (err) {
    await conn.rollback();
    console.error("COD ERROR:", err);
    res.status(500).json({ success: false });
  } finally {
    conn.release();
  }
});

module.exports = router;
