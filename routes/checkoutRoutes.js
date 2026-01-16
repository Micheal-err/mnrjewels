const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const Razorpay = require("razorpay");
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
  ci.is_gift,

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
         ci.is_gift,
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
let total = subtotal;
let grandTotal = total; // default: no coupon

    /* 1️⃣ CREATE ORDER */
   const [orderRes] = await conn.query(
  `
  INSERT INTO orders
  (user_id, total, grand_total, payment_method, payment_status, status)
  VALUES (?, ?, ?, ?, ?, ?)
  `,
  [
    userId,
    total,
    grandTotal,
    "cod",
    "unpaid",
    "pending"
  ]
);


    const orderId = orderRes.insertId;

    /* 2️⃣ ORDER ITEMS + STOCK UPDATE */
    for (const i of cart) {
     await conn.query(`
  INSERT INTO order_items
  (
    order_id,
    product_id,
    variant_id,
    product_name,
    quantity,
    price,
    is_gift
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`, [
  orderId,
  i.product_id,
  i.variant_id,
  i.name,        // ✅ freezes product name
  i.quantity,
  i.price,
  i.is_gift
]);



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

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

router.post("/razorpay/create-order", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { billing, coupon_code } = req.body;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* 1️⃣ Load cart */
    const [cart] = await conn.query(`
      SELECT
        ci.quantity,
        ci.is_gift,
        v.id AS variant_id,
        v.price,
        v.stock,
        v.sku,
        p.id AS product_id,
        p.name
      FROM cart_items ci
      JOIN product_variants v ON v.id = ci.variant_id
      JOIN products p ON p.id = v.product_id
      WHERE ci.user_id = ?
      FOR UPDATE
    `, [userId]);

    if (!cart.length) throw new Error("Cart empty");

    let subtotal = 0;
    cart.forEach(i => {
      if (i.stock < i.quantity) {
        throw new Error(`Out of stock: ${i.name}`);
      }
      subtotal += i.price * i.quantity;
    });

    /* 2️⃣ Coupon validation */
    let discount = 0;
    let couponId = null;

    if (coupon_code) {
      const [[coupon]] = await conn.query(`
        SELECT *
        FROM coupons
        WHERE code = ?
          AND active = 1
          AND (usage_limit IS NULL OR used_count < usage_limit)
      `, [coupon_code]);

      if (!coupon) throw new Error("Invalid coupon");

      discount = coupon.type === "percent"
        ? Math.min((subtotal * coupon.value) / 100, coupon.max_discount || 999999)
        : coupon.value;

      couponId = coupon.id;
    }

    const grandTotal = Math.max(subtotal - discount, 0);

    /* 3️⃣ Create order */
    const [orderRes] = await conn.query(`
      INSERT INTO orders
      (order_number, user_id, subtotal, discount, grand_total,
       coupon_id, coupon_code, payment_method, payment_status, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'razorpay', 'pending', 'pending_payment')
    `, [
      `ORD-${Date.now()}`,
      userId,
      subtotal,
      discount,
      grandTotal,
      couponId,
      coupon_code || null
    ]);

    const orderId = orderRes.insertId;

    /* 4️⃣ Order items snapshot */
    for (const i of cart) {
      await conn.query(`
        INSERT INTO order_items
        (order_id, product_id, variant_id, product_name, sku, price, quantity, is_gift)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        i.product_id,
        i.variant_id,
        i.name,
        i.sku,
        i.price,
        i.quantity,
        i.is_gift
      ]);
    }

    /* 5️⃣ Addresses */
    await conn.query(`
      INSERT INTO order_addresses
      (order_id, type, name, phone, email, address_line1, city, state, pincode, country)
      VALUES (?, 'billing', ?, ?, ?, ?, ?, ?, ?, 'India')
    `, [
      orderId,
      billing.name,
      billing.phone,
      billing.email,
      billing.address_line1,
      billing.city,
      billing.state,
      billing.pincode
    ]);

    /* 6️⃣ Razorpay order */
    const rpOrder = await razorpay.orders.create({
      amount: Math.round(grandTotal * 100),
      currency: "INR",
      receipt: `order_${orderId}`
    });

    await conn.query(`
      UPDATE orders
      SET razorpay_order_id = ?
      WHERE id = ?
    `, [rpOrder.id, orderId]);

    await conn.commit();

    res.json({
      success: true,
      orderId,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});


const crypto = require("crypto");

router.post("/razorpay/verify", authMiddleware, async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orderId
  } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: "Payment verification failed" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    /* mark paid */
    await conn.query(`
      UPDATE orders
      SET payment_status='paid',
          status='confirmed',
          razorpay_payment_id=?
      WHERE id = ?
    `, [razorpay_payment_id, orderId]);

    /* reduce stock NOW */
    const [items] = await conn.query(`
      SELECT variant_id, quantity
      FROM order_items
      WHERE order_id = ?
    `, [orderId]);

    for (const i of items) {
      await conn.query(`
        UPDATE product_variants
        SET stock = stock - ?
        WHERE id = ?
      `, [i.quantity, i.variant_id]);
    }

    /* clear cart */
    await conn.query(`DELETE FROM cart_items WHERE user_id = ?`, [req.user.id]);

    await conn.commit();

    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Payment verification failed" });
  } finally {
    conn.release();
  }
});



module.exports = router;
