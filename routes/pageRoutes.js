const express = require("express");
const router = express.Router();
const db = require("../config/db");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");
const adminAuth = require("../middleware/adminAuth");

// ========================= HOME =========================
router.get("/", async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT 
        p.*,
        MIN(v.price) AS price
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      GROUP BY p.id
      ORDER BY p.id DESC
      LIMIT 12
    `);

    res.render("pages/index", {
      title: "Home",
      products
    });

  } catch (err) {
    console.error("HOME PAGE ERROR:", err);
    res.render("pages/index", { title: "Home", products: [] });
  }
});

// ========================= CATEGORY LIST =========================
router.get("/category", async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT 
        p.*,
        MIN(v.price) AS price
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      GROUP BY p.id
      ORDER BY p.id DESC
      LIMIT 12
    `);

    res.render("pages/category", {
      title: "Category",
      products
    });

  } catch (err) {
    console.error("CATEGORY PAGE ERROR:", err);
    res.render("pages/category", { title: "Category", products: [] });
  }
});

// ========================= CATEGORY DETAILS =========================
router.get("/category/:name", async (req, res) => {
  try {
    const category = req.params.name;

    const [products] = await db.query(`
      SELECT 
        p.*,
        MIN(v.price) AS price
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE p.category = ?
      GROUP BY p.id
      ORDER BY p.id DESC
    `, [category]);

    res.render("pages/category", {
      title: category,
      products
    });

  } catch (err) {
    console.error("CATEGORY DETAIL ERROR:", err);
    res.render("pages/category", { title: req.params.name, products: [] });
  }
});

// ========================= PRODUCT DETAILS =========================
router.get("/product/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    // product
    const [[product]] = await db.query(
      "SELECT * FROM products WHERE id = ?",
      [productId]
    );

    if (!product) {
      return res.status(404).render("pages/404", {
        title: "Product not found"
      });
    }

    // images
    const images = [
      product.image1,
      product.image2,
      product.image3,
      product.image4
    ].filter(Boolean);

    // variants (price, stock, finish, size, etc.)
    const [variants] = await db.query(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY price ASC",
      [productId]
    );

    // related products (variant-aware)
    const [relatedProducts] = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.image1,
        MIN(v.price) AS price
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      WHERE p.category = ? AND p.id <> ?
      GROUP BY p.id
      LIMIT 4
    `, [product.category, product.id]);

    res.render("pages/product", {
      title: product.name,
      product,
      images,
      variants,
      relatedProducts
    });

  } catch (err) {
    console.error("PRODUCT PAGE ERROR:", err);
    res.status(500).render("pages/500", { title: "Server error" });
  }
});

// ========================= STATIC PAGES =========================
router.get("/about", (req, res) =>
  res.render("pages/about", { title: "About Us" })
);

router.get("/contact", (req, res) =>
  res.render("pages/contact", { title: "Contact" })
);

// ========================= ACCOUNT / WISHLIST =========================
router.get("/account", (req, res) =>
  res.render("pages/account", { title: "My Account" })
);

router.get("/wishlist", (req, res) =>
  res.render("pages/wishlist", { title: "My Wishlist" })
);

// ========================= ADMIN DASHBOARD =========================
router.get("/admin/dashboard", adminAuth, (req, res) => {
  res.render("admin/dashboard", { title: "Dashboard" });
});

// ========================= SOCIAL LOGIN CALLBACK =========================
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/account" }),
  async (req, res) => {
    try {
      const user = req.user;

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          is_admin: user.is_admin,
          provider: "google"
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // 🔴 THIS WAS MISSING
      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      const payload = Buffer.from(
        JSON.stringify({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          is_admin: user.is_admin,
          provider: "google"
        })
      ).toString("base64");

      res.redirect(`/account?token=${token}&user=${payload}`);

    } catch (err) {
      console.error("GOOGLE CALLBACK ERROR:", err);
      res.redirect("/account");
    }
  }
);

router.get("/shop/:category/:subCategory", async (req, res) => {
  try {
    const { category, subCategory } = req.params;
    const {
      collection,
      finish,
      gemstone,
      minPrice,
      maxPrice,
      sort
    } = req.query;

    const isAjax = req.headers["x-requested-with"] === "XMLHttpRequest";

    let sql = `
      SELECT DISTINCT
        p.id,
        p.name,
        p.collection_name,
        p.image1,
        v.price,
        v.finish,
        v.gemstones_colour
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      WHERE LOWER(p.category) = ?
        AND LOWER(p.sub_category) = ?
    `;

    const params = [
      category.toLowerCase(),
      subCategory.toLowerCase()
    ];

    /* COLLECTION */
    if (collection) {
      sql += ` AND p.collection_name IN (?)`;
      params.push(collection.split(","));
    }

    /* FINISH */
    if (finish) {
      sql += ` AND v.finish IN (?)`;
      params.push(finish.split(","));
    }

    /* GEMSTONE */
    if (gemstone) {
      sql += ` AND v.gemstones_colour IN (?)`;
      params.push(gemstone.split(","));
    }

    /* PRICE */
    if (minPrice) {
      sql += ` AND v.price >= ?`;
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      sql += ` AND v.price <= ?`;
      params.push(Number(maxPrice));
    }

    /* SORT */
    switch (sort) {
      case "low":
        sql += ` ORDER BY v.price ASC`;
        break;
      case "high":
        sql += ` ORDER BY v.price DESC`;
        break;
      case "new":
        sql += ` ORDER BY p.id DESC`;
        break;
      default:
        sql += ` ORDER BY p.id DESC`;
    }

    const [rows] = await db.query(sql, params);

    /* GROUP FOR SSR */
    const collections = {};
    rows.forEach(p => {
      if (!collections[p.collection_name]) {
        collections[p.collection_name] = [];
      }
      collections[p.collection_name].push(p);
    });

    /* AJAX RESPONSE */
    if (isAjax) {
      return res.json({
        products: rows,
        totalProducts: rows.length
      });
    }

    /* SSR RENDER */
    res.render("pages/category", {
      categoryTitle: `${category} / ${subCategory}`,
      collections,
      totalProducts: rows.length
    });

  } catch (err) {
    console.error("Category filter error:", err);
    res.status(500).send("Server error");
  }
});

router.get("/debug/cookie", (req, res) => {
  res.json({
    cookies: req.cookies,
    headers: req.headers.authorization || null
  });
});


module.exports = router;
