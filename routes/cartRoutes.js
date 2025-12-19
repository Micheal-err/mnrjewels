const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * ===============================
 * ➕ ADD TO CART (VARIANT-BASED)
 * ===============================
 */

// routes/productRoutes.js
// ===============================
// 🔎 GET PRODUCT VARIANTS (API)
// ===============================
router.get("/product/:id/variants", async (req, res) => {
  try {
    const productId = req.params.id;

    const [variants] = await db.query(
      `SELECT id, price, finish, length_size, width, thickness
       FROM product_variants
       WHERE product_id = ?`,
      [productId]
    );

    res.json({
      success: true,
      variants
    });

  } catch (err) {
    console.error("GET VARIANTS ERROR:", err);
    res.status(500).json({
      success: false,
      variants: []
    });
  }
});


router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { variant_id, quantity = 1 } = req.body;
    const user_id = req.user.id;

    if (!variant_id) {
      return res.status(400).json({
        success: false,
        message: "variant_id is required"
      });
    }

    // check if variant already in cart
    const [rows] = await db.query(
      "SELECT id FROM cart_items WHERE user_id=? AND variant_id=?",
      [user_id, variant_id]
    );

    if (rows.length > 0) {
      // update qty
      await db.query(
        "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
        [quantity, rows[0].id]
      );
    } else {
      // insert
      await db.query(
        "INSERT INTO cart_items (user_id, variant_id, quantity) VALUES (?, ?, ?)",
        [user_id, variant_id, quantity]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error("ADD TO CART ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ===============================
 * 🛒 GET USER CART (VARIANT AWARE)
 * ===============================
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;

    const [rows] = await db.query(`
      SELECT
        ci.id AS cart_id,
        ci.quantity,

        v.id AS variant_id,
        v.sku,
        v.price,
        v.length_size,
        v.width,
        v.thickness,
        v.finish,

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
    res.status(500).json({ success: false });
  }
});

/**
 * ===============================
 * ❌ REMOVE CART ITEM
 * ===============================
 */
router.post("/remove", authMiddleware, async (req, res) => {
  try {
    const { cart_id } = req.body;
    const user_id = req.user.id;

    const [result] = await db.query(
      "DELETE FROM cart_items WHERE id=? AND user_id=?",
      [cart_id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, message: "Item not found" });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("REMOVE CART ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ===============================
 * ➕➖ UPDATE QUANTITY
 * ===============================
 */
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const { cart_id, change } = req.body;

    await db.query(
      "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
      [change, cart_id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("UPDATE CART ERROR:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
