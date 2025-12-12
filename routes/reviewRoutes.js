const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Build stars
function buildStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

/* ============================================================
   1. CHECK IF USER PURCHASED PRODUCT
   URL → /api/reviews/validate/:user_id/:product_id
============================================================ */
router.get("/validate/:user_id/:product_id", async (req, res) => {
  try {
    const { user_id, product_id } = req.params;

    const [rows] = await db.query(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ?`,
      [user_id, product_id]
    );

    return res.json({ purchased: rows.length > 0 });
  } catch (err) {
    console.log("Validate error:", err);
    return res.status(500).json({ purchased: false });
  }
});

/* ============================================================
   2. API: RETURN REVIEWS AS JSON
   URL → /api/reviews/product/:id/reviews
============================================================ */
router.get("/product/:id/reviews", async (req, res) => {
  try {
    const productId = req.params.id;

    const [rows] = await db.query(
      `SELECT id, name, email, title, rating, comment,
              DATE_FORMAT(created_at, '%d/%m/%Y') AS created_at_formatted
       FROM reviews
       WHERE product_id = ?
       ORDER BY created_at DESC`,
      [productId]
    );

    const reviews = rows.map(r => ({
      ...r,
      stars: buildStars(r.rating)
    }));

    return res.json({ success: true, reviews });

  } catch (err) {
    console.log("API GET reviews error:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   3. SERVER PRODUCT PAGE
   URL → /product/:id    ← THIS IS WHAT YOU WANT
============================================================ */
router.get("/product/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    // Product
    const [productRows] = await db.query(
      "SELECT * FROM products WHERE id = ?",
      [productId]
    );
    if (!productRows.length) return res.render("404");
    const product = productRows[0];

    // Images
    const [imgRows] = await db.query(
      "SELECT image1, image2, image3, image4 FROM products WHERE id = ?",
      [productId]
    );
    const images = Object.values(imgRows[0]).filter(x => x);

    // Related
    const [relatedProducts] = await db.query(
      `SELECT id, name, price, image1 
       FROM products
       WHERE category = (SELECT category FROM products WHERE id = ?)
       AND id != ?
       LIMIT 4`,
      [productId, productId]
    );

    // Reviews
    const [reviews] = await db.query(
      `SELECT id, name, email, title, rating, comment,
              DATE_FORMAT(created_at, '%d/%m/%Y') AS created_at_formatted
       FROM reviews
       WHERE product_id = ?
       ORDER BY created_at DESC`,
      [productId]
    );

    reviews.forEach(r => r.stars = buildStars(r.rating));

    // Stats
    const [statsRows] = await db.query(
      `SELECT AVG(rating) AS avgRating, COUNT(*) AS total
       FROM reviews WHERE product_id = ?`,
      [productId]
    );

    const s = statsRows[0] || {};
    const avg = s.avgRating ? Number(s.avgRating) : null;

    const reviewStats = {
      avgRating: avg ? avg.toFixed(1) : null,
      avgStars: avg ? buildStars(Math.round(avg)) : "★★★★★",
      total: s.total || 0,
      moreThanOne: (s.total || 0) > 1
    };

    // Render correct file: views/pages/product.hbs
    res.render("pages/product", {
      product,
      images,
      relatedProducts,
      reviews,
      reviewStats
    });
console.log("🟢 Product page route hit");
console.log("Reviews fetched:", reviews);

  } catch (err) {
    console.log("Product page error:", err);
    res.render("500");
  }
});

/* ============================================================
   4. SUBMIT REVIEW
   URL → POST /api/reviews/product/:id/reviews
============================================================ */
router.post("/product/:id/reviews", async (req, res) => {
  try {
    const productId = req.params.id;
    const { user_id, name, email, title, rating, comment } = req.body;

    if (!user_id)
      return res.status(401).json({ success: false, message: "Login required" });

    // Check purchase
    const [rows] = await db.query(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ?`,
      [user_id, productId]
    );

    if (!rows.length)
      return res.status(403).json({
        success: false,
        message: "You must purchase before reviewing."
      });

    await db.query(
      `INSERT INTO reviews (product_id, name, email, title, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productId, name, email, title, Number(rating), comment]
    );

    return res.json({ success: true });

  } catch (err) {
    console.log("Review insert error:", err);
    return res.status(500).json({ success: false });
  }
});



/* ============================================================
   UPDATE REVIEW
   URL → POST /api/reviews/product/:productId/reviews/:reviewId
============================================================ */
router.post("/product/:productId/reviews/:reviewId", async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const { email, title, comment, rating } = req.body;

    // Only allow updating if this review belongs to this email
    const [check] = await db.query(
      `SELECT id FROM reviews WHERE id = ? AND email = ? AND product_id = ?`,
      [reviewId, email, productId]
    );

    if (!check.length) {
      return res.status(403).json({
        success: false,
        message: "Not allowed"
      });
    }

    await db.query(
      `UPDATE reviews 
       SET title = ?, comment = ?, rating = ? 
       WHERE id = ?`,
      [title, comment, Number(rating), reviewId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.log("Review update error:", err);
    return res.status(500).json({ success: false });
  }
});



/* ============================================================
   DELETE REVIEW
   URL → POST /api/reviews/product/:productId/reviews/:reviewId/delete
============================================================ */
router.post("/product/:productId/reviews/:reviewId/delete", async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const { email } = req.body;

    // Only allow deleting if belongs to email
    const [check] = await db.query(
      `SELECT id FROM reviews WHERE id = ? AND email = ? AND product_id = ?`,
      [reviewId, email, productId]
    );

    if (!check.length) {
      return res.status(403).json({
        success: false,
        message: "Not allowed"
      });
    }

    await db.query(
      `DELETE FROM reviews WHERE id = ?`,
      [reviewId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.log("Review delete error:", err);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;
