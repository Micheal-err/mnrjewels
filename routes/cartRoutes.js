const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

/* ===============================
   🔎 GET PRODUCT VARIANTS
================================ */
router.get("/product/:id/variants", async (req, res) => {
  try {
    const [variants] = await db.query(
      `SELECT id, price, finish, length_size, width, thickness, stock
       FROM product_variants
       WHERE product_id = ?`,
      [req.params.id]
    );

    res.json({ success: true, variants });
  } catch (err) {
    console.error("GET VARIANTS ERROR:", err);
    res.status(500).json({ success: false, variants: [] });
  }
});

/* ===============================
   ➕ ADD TO CART (SAFE)
================================ */
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { variant_id, quantity = 1, is_gift = false } = req.body;
const giftFlag = is_gift ? 1 : 0;

    const user_id = req.user.id;

    if (!variant_id || quantity < 1) {
      return res.json({ success: false, message: "Invalid request" });
    }

    // 🔎 variant stock
    const [[variant]] = await db.query(
      `SELECT stock FROM product_variants WHERE id=?`,
      [variant_id]
    );

    if (!variant) {
      return res.json({ success: false, message: "Variant not found" });
    }

    // 🔎 already in cart?
    const [[existing]] = await db.query(
      `SELECT id, quantity FROM cart_items
       WHERE user_id=? AND variant_id=?`,
      [user_id, variant_id]
    );

    if (existing) {
      const newQty = existing.quantity + quantity;

      if (newQty > variant.stock) {
        return res.json({
          success: false,
          message: "Stock limit reached"
        });
      }

      await db.query(
        `UPDATE cart_items SET quantity=? WHERE id=?`,
        [newQty, existing.id]
      );

      return res.json({ success: true, merged: true });
    }

    // ❌ adding more than stock
    if (quantity > variant.stock) {
      return res.json({
        success: false,
        message: "Insufficient stock"
      });
    }

 await db.query(
  `INSERT INTO cart_items (user_id, variant_id, quantity, is_gift)
   VALUES (?, ?, ?, ?)`,
  [user_id, variant_id, quantity, giftFlag]
);


    res.json({ success: true });

  } catch (err) {
    console.error("ADD TO CART ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ===============================
   🛒 GET USER CART
================================ */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;

    const [rows] = await db.query(`
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
    `, [user_id]);

    res.json({ success: true, cart: rows });

  } catch (err) {
    console.error("GET CART ERROR:", err);
    res.status(500).json({ success: false, cart: [] });
  }
});

/* ===============================
   ➕➖ UPDATE QUANTITY (SAFE)
================================ */
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const { cart_id, change } = req.body;
    const user_id = req.user.id;

    // 🔎 cart item + stock
    const [[item]] = await db.query(`
      SELECT ci.quantity, v.stock
      FROM cart_items ci
      JOIN product_variants v ON v.id = ci.variant_id
      WHERE ci.id=? AND ci.user_id=?
    `, [cart_id, user_id]);

    if (!item) {
      return res.json({ success: false });
    }

    const newQty = item.quantity + change;

    if (newQty < 1) {
      return res.json({ success: false });
    }

    if (newQty > item.stock) {
      return res.json({
        success: false,
        message: "Stock limit reached"
      });
    }

await db.query(
  `UPDATE cart_items 
   SET quantity = ?
   WHERE id = ?`,
  [newQty, cart_id]
);



    res.json({ success: true });

  } catch (err) {
    console.error("UPDATE CART ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ===============================
   ❌ REMOVE ITEM
================================ */
router.post("/remove", authMiddleware, async (req, res) => {
  try {
    const { cart_id } = req.body;
    const user_id = req.user.id;

    const [result] = await db.query(
      `DELETE FROM cart_items WHERE id=? AND user_id=?`,
      [cart_id, user_id]
    );

    if (!result.affectedRows) {
      return res.json({ success: false });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("REMOVE CART ERROR:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
