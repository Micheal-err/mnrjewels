const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/toggle", authMiddleware, async (req, res) => {
  try {
    const { product_id } = req.body;
    const user_id = req.user.id;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "Product ID required"
      });
    }

    // 1️⃣ Check if already in wishlist
    const [rows] = await db.query(
      "SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?",
      [user_id, product_id]
    );

    // 2️⃣ Remove if exists
    if (rows.length > 0) {
      await db.query(
        "DELETE FROM wishlist WHERE user_id = ? AND product_id = ?",
        [user_id, product_id]
      );

      return res.json({
        success: true,
        added: false
      });
    }

    // 3️⃣ Add if not exists
    await db.query(
      "INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)",
      [user_id, product_id]
    );

    return res.json({
      success: true,
      added: true
    });

  } catch (err) {
    console.error("Wishlist toggle error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});



router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

   const [products] = await db.query(`
  SELECT 
    p.id,
    p.name,
    p.image1,
    MIN(v.price) AS price
  FROM wishlist w
  JOIN products p ON p.id = w.product_id
  JOIN product_variants v ON v.product_id = p.id
  WHERE w.user_id = ?
  GROUP BY p.id
`, [userId]);

    res.json({
      success: true,
      products
    });

  } catch (err) {
    console.error("WISHLIST API ERROR:", err);
    res.status(500).json({
      success: false,
      products: []
    });
  }
});

router.get("/check/:productId", authMiddleware, async (req, res) => {
  const [rows] = await db.query(
    "SELECT id FROM wishlist WHERE user_id=? AND product_id=?",
    [req.user.id, req.params.productId]
  );
  res.json({ inWishlist: rows.length > 0 });
});


module.exports = router;
