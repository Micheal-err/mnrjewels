const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authUser = require("../middleware/authMiddleware");

// Build stars
function buildStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

/* ============================================================
   1. CHECK IF USER CAN REVIEW PRODUCT
   GET /api/reviews/can-review/:productId
============================================================ */
router.get("/can-review/:productId", authUser, async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  const [rows] = await db.query(
    `
    SELECT oi.id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = ?
      AND oi.product_id = ?
      AND o.payment_status = 'paid'
    LIMIT 1
    `,
    [userId, productId]
  );

  if (!rows.length) {
    return res.json({
      canReview: false,
      reason: "purchase"
    });
  }

  res.json({ canReview: true });
});


/* ============================================================
   2. GET REVIEWS (JSON API)
   GET /api/reviews/product/:id/reviews
============================================================ */
router.get("/product/:id/reviews", async (req, res) => {
  try {
    const productId = req.params.id;

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.user_id,
        r.title,
        r.comment,
        r.rating,
        r.created_at,
        DATE_FORMAT(r.created_at, '%d %b %Y') AS created_at_formatted,
        u.first_name,
        u.last_name,
        u.email
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ?
      ORDER BY r.id DESC
      `,
      [productId]
    );

    res.json({ success: true, reviews: rows });

  } catch (err) {
    console.error("GET reviews error:", err);
    res.status(500).json({ success: false });
  }
});


/* ============================================================
   3. SUBMIT REVIEW
   POST /api/reviews/product/:id/reviews
============================================================ */
router.post("/product/:id/reviews", authUser, async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.id;
  const { title, rating, comment } = req.body;

  // Check purchase
  const [rows] = await db.query(
    `
    SELECT oi.id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = ?
      AND oi.product_id = ?
      AND o.payment_status = 'paid'
    LIMIT 1
    `,
    [userId, productId]
  );

  if (!rows.length) {
    return res.status(403).json({
      success: false,
      message: "Purchase required to review"
    });
  }

  // Prevent duplicate review
  const [exists] = await db.query(
    "SELECT id FROM reviews WHERE product_id=? AND user_id=?",
    [productId, userId]
  );

  if (exists.length) {
    return res.status(409).json({
      success: false,
      message: "You already reviewed this product"
    });
  }

  await db.query(
    `
    INSERT INTO reviews
      (product_id, user_id, title, rating, comment)
    VALUES (?, ?, ?, ?, ?)
    `,
    [productId, userId, title, Number(rating), comment]
  );

  res.json({ success: true });
});

/* ============================================================
   4. UPDATE REVIEW
   POST /api/reviews/product/:productId/reviews/:reviewId
============================================================ */
router.post(
  "/product/:productId/reviews/:reviewId",
  authUser,
  async (req, res) => {

    const userId = req.user.id;
    const { reviewId } = req.params;
    const { title, comment, rating } = req.body;

    const [own] = await db.query(
      "SELECT id FROM reviews WHERE id=? AND user_id=?",
      [reviewId, userId]
    );

    if (!own.length) {
      return res.status(403).json({
        success: false,
        message: "Not allowed"
      });
    }

    await db.query(
      `
      UPDATE reviews
      SET title=?, comment=?, rating=?
      WHERE id=?
    `,
      [title, comment, Number(rating), reviewId]
    );

    res.json({ success: true });
  }
);

/* ============================================================
   5. DELETE REVIEW
   POST /api/reviews/product/:productId/reviews/:reviewId/delete
============================================================ */
router.post(
  "/product/:productId/reviews/:reviewId/delete",
  authUser,
  async (req, res) => {

    const userId = req.user.id;
    const { reviewId } = req.params;

    const [own] = await db.query(
      "SELECT id FROM reviews WHERE id=? AND user_id=?",
      [reviewId, userId]
    );

    if (!own.length) {
      return res.status(403).json({
        success: false,
        message: "Not allowed"
      });
    }

    await db.query("DELETE FROM reviews WHERE id=?", [reviewId]);
    res.json({ success: true });
  }
);

module.exports = router;
