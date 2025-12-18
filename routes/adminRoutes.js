const express = require("express");
const router = express.Router();
const db = require("../config/db");
const adminAuth = require("../middleware/adminAuth");
const multer = require("multer");
const path = require("path");


//get all users
router.get("/users", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM users ORDER BY id DESC`);
    res.json({ success: true, users: rows });
  } catch (err) {
    console.log("Get users error:", err);
    res.status(500).json({ success: false });
  }
});

//create a new user
router.post("/users", adminAuth, async (req, res) => {
  const { first_name, last_name, email, password, is_admin } = req.body;

  try {
    await db.query(
      `INSERT INTO users (first_name, last_name, email, password, is_admin)
       VALUES (?, ?, ?, ?, ?)`,
      [first_name, last_name, email, password, is_admin ? 1 : 0]
    );
    res.json({ success: true });
  } catch (err) {
    console.log("Create user error:", err);
    res.status(500).json({ success: false });
  }
});

//edit an existing user
router.post("/users/:id", adminAuth, async (req, res) => {
  const { first_name, last_name, email, is_admin } = req.body;
  const id = req.params.id;

  try {
    await db.query(
      `UPDATE users SET first_name=?, last_name=?, email=?, is_admin=? WHERE id=?`,
      [first_name, last_name, email, is_admin ? 1 : 0, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.log("Update user error:", err);
    res.status(500).json({ success: false });
  }
});


//delete a user
router.post("/users/:id/delete", adminAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM users WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.log("Delete user error:", err);
    res.status(500).json({ success: false });
  }
});


/* ===============================
   📦 MULTER CONFIG
================================ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage });

/* ===============================
   🧩 PRODUCTS (DESIGN ONLY)
================================ */

/**
 * GET ALL PRODUCTS
 */
router.get("/products", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.*,
        COUNT(v.id) AS variant_count
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      GROUP BY p.id
      ORDER BY p.id DESC
    `);

    res.json({ success: true, products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


/**
 * CREATE PRODUCT (DESIGN + IMAGES)
 */
router.post(
  "/products",
  adminAuth,
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
    { name: "image4", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
  name,
  description,
  category,
  sub_category,
  collection_name,
  category_description,
  metal,
  diamonds
} = req.body;


      if (!name) {
        return res.status(400).json({ success: false, message: "Name is required" });
      }

      const images = {
        image1: req.files.image1?.[0]?.filename || null,
        image2: req.files.image2?.[0]?.filename || null,
        image3: req.files.image3?.[0]?.filename || null,
        image4: req.files.image4?.[0]?.filename || null
      };

      const [result] = await db.query(`
        INSERT INTO products (
  name, description, category, sub_category,
  collection_name, category_description,
  metal, diamonds,
  image1, image2, image3, image4
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

      `, [
  name, description, category, sub_category,
  collection_name, category_description,
  metal, diamonds,
  images.image1, images.image2, images.image3, images.image4
]);

      res.json({
        success: true,
        product_id: result.insertId
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  }
);

/**
 * UPDATE PRODUCT
 */
router.put(
  "/products/:id",
  adminAuth,
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
    { name: "image4", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
    const {
  name,
  description,
  category,
  sub_category,
  collection_name,
  category_description,
  metal,
  diamonds
} = req.body;


      const images = {
        image1: req.files.image1?.[0]?.filename || null,
        image2: req.files.image2?.[0]?.filename || null,
        image3: req.files.image3?.[0]?.filename || null,
        image4: req.files.image4?.[0]?.filename || null
      };

      await db.query(`
        UPDATE products SET
  name=?, description=?, category=?, sub_category=?,
  collection_name=?, category_description=?,
  metal=?, diamonds=?,
  image1=IFNULL(?, image1),
  image2=IFNULL(?, image2),
  image3=IFNULL(?, image3),
  image4=IFNULL(?, image4)
WHERE id=?

      `, [
        name, description, category, sub_category,
        collection_name, category_description,
        metal, diamonds,
        images.image1, images.image2, images.image3, images.image4,
        req.params.id
      ]);

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  }
);

/**
 * DELETE PRODUCT (VARIANTS AUTO-DELETED)
 */
router.post("/products/:id/delete", adminAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM products WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ===============================
   🧩 VARIANTS (SELLABLE UNITS)
================================ */

/**
 * GET VARIANTS FOR A PRODUCT
 */
router.get("/products/:productId/variants", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM product_variants WHERE product_id=?`,
      [req.params.productId]
    );
    res.json({ success: true, variants: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/**
 * ADD VARIANT
 */
// ================= VARIANT CREATE / UPDATE =================
router.post("/variants", adminAuth, async (req, res) => {
  try {
    const {
      id,                // only on edit
      product_id,
      sku,
      price,
      length_size,
      width,
      thickness,
      finish,
      gemstones_colour,  // ✅ NEW
      stock
    } = req.body;

    if (!product_id || !price) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // ================= UPDATE =================
    if (id) {
      await db.query(`
        UPDATE product_variants SET
          price = ?,
          length_size = ?,
          width = ?,
          thickness = ?,
          finish = ?,
          gemstones_colour = ?,
          stock = ?
        WHERE id = ?
      `, [
        price,
        length_size,
        width,
        thickness,
        finish,
        gemstones_colour,
        stock,
        id
      ]);

      return res.json({ success: true, mode: "updated" });
    }

    // ================= CREATE =================
    await db.query(`
      INSERT INTO product_variants
      (product_id, sku, price, length_size, width, thickness, finish, gemstones_colour, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product_id,
      sku,
      price,
      length_size,
      width,
      thickness,
      finish,
      gemstones_colour,
      stock
    ]);

    res.json({ success: true, mode: "created" });

  } catch (err) {
    console.error("VARIANT SAVE ERROR:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "SKU already exists"
      });
    }

    res.status(500).json({ success: false });
  }
});





/**
 * DELETE VARIANT
 */
router.post("/variants/:id/delete", adminAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM product_variants WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ===============================
// ✅ REVIEWS MODULE
// ===============================

//get all reviews
router.get("/reviews", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         r.*,
         p.id   AS product_id,
         p.name AS product_name
       FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ORDER BY r.id DESC`
    );

    res.json({ success: true, reviews: rows });
  } catch (err) {
    console.log("Get reviews error:", err);
    res.status(500).json({ success: false });
  }
});



//edit a review
router.post("/reviews/:id", adminAuth, async (req, res) => {
  const { title, comment, rating } = req.body;

  try {
    await db.query(
      `UPDATE reviews SET title=?, comment=?, rating=? WHERE id=?`,
      [title, comment, rating, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.log("Edit review error:", err);
    res.status(500).json({ success: false });
  }
});


//delete a review

router.post("/reviews/:id/delete", adminAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM reviews WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.log("Delete review error:", err);
    res.status(500).json({ success: false });
  }
});


// ===============================
// ✅ ORDERS MODULE
// ===============================

//get all orders
router.get("/orders", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.*, u.first_name, u.last_name, u.email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.id DESC
    `);

    res.json({ success: true, orders: rows });
  } catch (err) {
    console.log("Get orders error:", err);
    res.status(500).json({ success: false });
  }
});


//create an order
router.post("/orders", adminAuth, async (req, res) => {
  const { user_id, total_amount, status, payment_status, admin_notes } = req.body;

  try {
    await db.query(
      `INSERT INTO orders (user_id, total_amount, status, payment_status, admin_notes)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, total_amount, status, payment_status, admin_notes]
    );

    res.json({ success: true });
  } catch (err) {
    console.log("Create order error:", err);
    res.status(500).json({ success: false });
  }
});


//edit an order
router.post("/orders/:id", adminAuth, async (req, res) => {
  const { status, payment_status, admin_notes } = req.body;

  try {
    await db.query(
      `UPDATE orders SET status=?, payment_status=?, admin_notes=? WHERE id=?`,
      [status, payment_status, admin_notes, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.log("Edit order error:", err);
    res.status(500).json({ success: false });
  }
});


//delete an order
router.post("/orders/:id/delete", adminAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM orders WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.log("Delete order error:", err);
    res.status(500).json({ success: false });
  }
});


// Get All Messages

router.get("/messages", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM contact_messages ORDER BY id DESC");
        res.json({ messages: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ messages: [] });
    }
});


// Edit Message (mark as read / update)
router.post("/messages/:id", adminAuth, async (req, res) => {
  const { name, email, phone, message, status } = req.body;
  const { id } = req.params;

  try {
    // CASE 1: Toggle read/unread → ONLY update status
    const isToggle = 
      (name === undefined && email === undefined && phone === undefined && message === undefined);

    if (isToggle) {
      await db.query("UPDATE contact_messages SET status=? WHERE id=?", [status, id]);
      return res.json({ success: true });
    }

    // CASE 2: Save from EDIT modal → update all fields
    await db.query(
      `UPDATE contact_messages 
       SET name=?, email=?, phone=?, message=?, status=? 
       WHERE id=?`,
      [name, email, phone, message, status, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.log("Edit message error:", err);
    res.status(500).json({ success: false });
  }
});



// Delete Message

router.post("/messages/:id/delete", adminAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM contact_messages WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.log("Delete message error:", err);
    res.status(500).json({ success: false });
  }
});



module.exports = router;



