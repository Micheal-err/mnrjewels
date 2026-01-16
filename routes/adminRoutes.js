const express = require("express");
const router = express.Router();
const db = require("../config/db");
const adminAuth = require("../middleware/adminAuth");
const multer = require("multer");
const path = require("path");


router.get("/dashboard", adminAuth, (req, res) => {
  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    admin: true,
    user: req.user
  });
});

router.get("/view/dashboard", adminAuth, (req, res) => {
  res.render("admin/dashboard", { layout: false });
});

router.get("/view/users", adminAuth, (req, res) => {
  res.render("admin/sections/users", { layout: false });
});

router.get("/view/allProducts", adminAuth, (req, res) => {
  res.render("admin/sections/allProducts", { layout: false });
});

router.get("/view/orders", adminAuth, (req, res) => {
  res.render("admin/sections/orders", { layout: false });
});

router.get("/view/reviews", adminAuth, (req, res) => {
  res.render("admin/sections/allReviews", { layout: false });
});

router.get("/view/messages", adminAuth, (req, res) => {
  res.render("admin/sections/messages", { layout: false });
});


router.get("/dashboard/stats", adminAuth, async (req, res) => {
  try {
    const [[stats]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM orders) AS totalOrders,
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM orders WHERE status='pending') AS pendingOrders,
        (
          SELECT IFNULL(SUM(grand_total), 0)
          FROM orders
          WHERE payment_status='paid'
            AND status!='cancelled'
        ) AS totalRevenue
    `);

    res.json(stats);
  } catch (err) {
    console.error("DASHBOARD STATS ERROR:", err);
    res.status(500).json({});
  }
});


router.get("/dashboard/out-of-stock", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.name,
        v.sku,
        v.stock
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.stock = 0
      ORDER BY p.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("OUT OF STOCK ERROR:", err);
    res.status(500).json([]);
  }
});

router.get("/dashboard/most-carted", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.image1,
        SUM(ci.quantity) AS total_added
      FROM cart_items ci
      JOIN product_variants v ON v.id = ci.variant_id
      JOIN products p ON p.id = v.product_id
      GROUP BY p.id
      ORDER BY total_added DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (err) {
    console.error("MOST CARTED ERROR:", err);
    res.status(500).json([]);
  }
});


router.get("/dashboard/most-wishlisted", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.image1,
        COUNT(w.id) AS total_added
      FROM wishlist w
      JOIN products p ON p.id = w.product_id
      GROUP BY p.id
      ORDER BY total_added DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (err) {
    console.error("MOST WISHLISTED ERROR:", err);
    res.status(500).json([]);
  }
});

router.get("/dashboard/recent-orders", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        o.id,
        COALESCE(o.order_number, CONCAT('ORD-', o.id)) AS order_number,
        COALESCE(o.grand_total, 0) AS grand_total,
        o.status,
        u.first_name,
        u.last_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.id DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (err) {
    console.error("RECENT ORDERS ERROR:", err);
    res.status(500).json([]);
  }
});



router.get("/dashboard/recent-users", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        first_name,
        last_name,
        email
      FROM users
      ORDER BY id DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (err) {
    console.error("RECENT USERS ERROR:", err);
    res.status(500).json([]);
  }
});

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

// ===============================
// 👤 USER WISHLIST (ADMIN)
// ===============================
router.get("/users/:id/wishlist", adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.image1
      FROM wishlist w
      JOIN products p ON p.id = w.product_id
      WHERE w.user_id = ?
      ORDER BY w.id DESC
    `, [userId]);

    res.json({ success: true, items: rows });

  } catch (err) {
    console.log("Admin user wishlist error:", err);
    res.status(500).json({ success: false, items: [] });
  }
});
// ===============================
// 🛒 USER CART (ADMIN) – FINAL
// ===============================
router.get("/users/:id/cart", adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    const [rows] = await db.query(`
      SELECT
        ci.id           AS cart_item_id,
        ci.quantity,
        p.id            AS product_id,
        p.name,
        p.image1,
        v.id            AS variant_id,
        v.finish,
        v.gemstones_colour,
        v.length_size,
        v.width,
        v.thickness,
        v.price
      FROM cart_items ci
      JOIN product_variants v ON v.id = ci.variant_id
      JOIN products p ON p.id = v.product_id
      WHERE ci.user_id = ?
      ORDER BY ci.id DESC
    `, [userId]);

    res.json({ success: true, items: rows });

  } catch (err) {
    console.error("Admin user cart error:", err);
    res.status(500).json({ success: false, items: [] });
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
// 📦 ADMIN ORDERS MODULE (FINAL)
// ===============================

/**
 * GET ALL ORDERS (ADMIN)
 */
router.get("/orders", adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        o.id,
        COALESCE(o.order_number, CONCAT('ORD-', o.id)) AS order_number,

        /* 👤 customer */
        COALESCE(
          CONCAT(u.first_name, ' ', u.last_name),
          'Guest'
        ) AS customer_name,

        u.email,

        /* 💰 money */
        COALESCE(o.subtotal, 0)        AS subtotal,
        COALESCE(o.discount, 0)        AS discount,
        COALESCE(o.grand_total, 0)     AS grand_total,

        /* 🎟 coupon */
        o.coupon_code,

        /* 📦 status */
        o.status,
        o.payment_status,
        o.created_at

      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.id DESC
    `);

    res.json({
      success: true,
      orders: rows
    });
  } catch (err) {
    console.error("ADMIN ORDERS LIST ERROR:", err);
    res.status(500).json({ success: false, orders: [] });
  }
});


/**
 * GET SINGLE ORDER (DETAIL VIEW)
 */
// ===============================
// 📦 GET SINGLE ORDER (ADMIN)
// ===============================
router.get("/orders/:id", adminAuth, async (req, res) => {
  const orderId = req.params.id;

  try {
    /* ================= ORDER ================= */
    const [[order]] = await db.query(`
      SELECT
        o.id,
        COALESCE(o.order_number, CONCAT('ORD-', o.id)) AS order_number,
        COALESCE(CONCAT(u.first_name,' ',u.last_name),'Guest') AS customer_name,
        u.email,
        o.subtotal,
        o.discount,
        o.grand_total,
        o.coupon_code,
        o.status,
        o.payment_status,
        o.created_at
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) {
      return res.status(404).json({ success: false });
    }

    /* ================= ITEMS ================= */
    const [items] = await db.query(`
      SELECT
        p.name AS product_name,
        pv.sku,
        oi.quantity,
        oi.price,
        oi.is_gift,
        (oi.price * oi.quantity) AS total
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      WHERE oi.order_id = ?
    `, [orderId]);

    const hasGift = items.some(i => i.is_gift === 1);

    /* ================= BILLING ADDRESS ================= */
  const [[billing]] = await db.query(`
  SELECT *
  FROM order_addresses
  WHERE order_id = ? AND type = 'billing'
  LIMIT 1
`, [orderId]);


    /* ================= STATUS HISTORY ================= */
    const [statusHistory] = await db.query(`
      SELECT status, comment, created_at
      FROM order_status_history
      WHERE order_id = ?
      ORDER BY created_at ASC
    `, [orderId]);

    res.json({
      success: true,
      order,
      billing,        // 👈 IMPORTANT
      items,
      hasGift,
      statusHistory
    });

  } catch (err) {
    console.error("ADMIN ORDER DETAIL ERROR:", err);
    res.status(500).json({ success: false });
  }
});


/**
 * UPDATE ORDER STATUS (PAYMENT-LOCKED)
 */
router.post("/orders/:id/status", adminAuth, async (req, res) => {
  const { status, comment } = req.body;
  const orderId = req.params.id;

  try {
    const [[order]] = await db.query(
      `SELECT payment_status FROM orders WHERE id=?`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ success: false });
    }

    // ⛔ Payment lock ONLY for forward statuses
    const paymentLockedStatuses = [
      "confirmed",
      "processing",
      "shipped",
      "delivered"
    ];

    if (
      paymentLockedStatuses.includes(status) &&
      order.payment_status !== "paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment must be PAID before moving order forward"
      });
    }

    // ✅ CANCELLED is ALWAYS allowed
    await db.query(
      `UPDATE orders SET status=?, updated_at=NOW() WHERE id=?`,
      [status, orderId]
    );

    await db.query(`
      INSERT INTO order_status_history
      (order_id, status, changed_by, comment)
      VALUES (?, ?, 'admin', ?)
    `, [orderId, status, comment || null]);

    res.json({ success: true });

  } catch (err) {
    console.error("ORDER STATUS UPDATE ERROR:", err);
    res.status(500).json({ success: false });
  }
});


/**
 * CANCEL ORDER (ADMIN – NO DELETE)
 */
router.post("/orders/:id/cancel", adminAuth, async (req, res) => {
  const orderId = req.params.id;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 🔒 Lock order
    const [[order]] = await conn.query(`
      SELECT status, payment_status
      FROM orders
      WHERE id=?
      FOR UPDATE
    `, [orderId]);

    if (!order) throw new Error("Order not found");

    if (order.status === "cancelled") {
      await conn.rollback();
      return res.json({ success: true });
    }

    // 🔁 Restore stock ONLY if payment was done
    if (order.payment_status === "paid") {
      const [items] = await conn.query(`
        SELECT variant_id, quantity
        FROM order_items
        WHERE order_id=?
      `, [orderId]);

      for (const i of items) {
        await conn.query(`
          UPDATE product_variants
          SET stock = stock + ?
          WHERE id = ?
        `, [i.quantity, i.variant_id]);
      }
    }

    // ❌ Cancel order
    await conn.query(`
      UPDATE orders
      SET status='cancelled',
          payment_status = CASE
            WHEN payment_status='paid' THEN 'refunded'
            ELSE payment_status
          END,
          updated_at=NOW()
      WHERE id=?
    `, [orderId]);

    // 🧾 History
    await conn.query(`
      INSERT INTO order_status_history
      (order_id, status, changed_by, comment)
      VALUES (?, 'cancelled', 'admin', 'Cancelled by admin')
    `, [orderId]);

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    console.error("CANCEL ORDER ERROR:", err);
    res.status(400).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});



/**
 * UPDATE PAYMENT STATUS (ADMIN VERIFIED)
 */
router.post("/orders/:id/payment", adminAuth, async (req, res) => {
  const { payment_status, comment } = req.body;
  const orderId = req.params.id;

  try {
    const [[order]] = await db.query(
      `SELECT payment_status FROM orders WHERE id=?`,
      [orderId]
    );

    if (!order) return res.status(404).json({ success: false });

    if (order.payment_status !== "paid" && payment_status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment can only be marked PAID via gateway"
      });
    }

    await db.query(`
      UPDATE orders
      SET payment_status=?, updated_at=NOW()
      WHERE id=?
    `, [payment_status, orderId]);

    await db.query(`
      INSERT INTO order_payment_history
      (order_id, payment_status, changed_by, comment)
      VALUES (?, ?, 'admin', ?)
    `, [orderId, payment_status, comment || null]);

    res.json({ success: true });

  } catch (err) {
    console.error("PAYMENT UPDATE ERROR:", err);
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



