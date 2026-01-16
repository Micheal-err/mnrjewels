const express = require('express');
const router = express.Router();
const db = require('../config/db'); // make sure this exists
const productController = require('../controllers/productController');
const upload = require('../middleware/upload');

/* ---------------- SEARCH (MUST BE FIRST) ---------------- */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q?.trim();

    if (!q || q.length < 2) {
      return res.json({ success: true, products: [] });
    }

    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.name,
        MIN(v.price) AS price,
        p.image1
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      WHERE
        p.name LIKE ?
        OR p.category LIKE ?
        OR p.sub_category LIKE ?
        OR p.collection_name LIKE ?
      GROUP BY p.id, p.name, p.image1
      ORDER BY
        CASE
          WHEN p.name LIKE ? THEN 1
          ELSE 2
        END
      LIMIT 8
      `,
      [
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `${q}%`
      ]
    );

    res.json({ success: true, products: rows });

  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({ success: false, products: [] });
  }
});


/* ---------------- CRUD ROUTES ---------------- */
router.post('/', upload, productController.createProduct);
router.put('/:id', upload, productController.updateProduct);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
