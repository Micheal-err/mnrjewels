const express = require("express");
const router = express.Router();
const db = require("../config/db");
const passport = require("passport");
const jwt = require("jsonwebtoken");

// ========================= HOME =========================
router.get("/", async (req, res) => {
  try {
    const [products] = await db.query("SELECT * FROM products LIMIT 12");
    res.render("pages/index", { title: "Home", products });
  } catch (err) {
    console.error(err);
    res.render("pages/index", { title: "Home", products: [] });
  }
});

// ========================= CATEGORY =========================
router.get("/category", async (req, res) => {
  try {
    const [products] = await db.query("SELECT * FROM products LIMIT 12");
    res.render("pages/category", { title: "Category", products });
  } catch {
    res.render("pages/category", { title: "Category", products: [] });
  }
});

// ========================= STATIC PAGES =========================
router.get("/about", (req, res) => res.render("pages/about", { title: "About Us" }));
router.get("/contact", (req, res) => res.render("pages/contact", { title: "Contact" }));

// ========================= ACCOUNT PAGE =========================
router.get("/account", (req, res) => {
  res.render("pages/account", { title: "My Account" });
});
router.get("/admin/dashboard", (req, res) => {
  res.render("admin/dashboard", { title: "Dashboard" });
});

// When social login success returns
router.get("/account/social-login-success", (req, res) => {
    const token = req.query.token || "";
    const user = req.query.user || "";
    res.render("pages/account", { token, user });
});

// ========================= GOOGLE CALLBACK =========================
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/account" }),
  async (req, res) => {
    try {
      const user = req.user;

      const token = jwt.sign(
        { id: user.id, email: user.email, provider: "google" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const payload = Buffer.from(JSON.stringify({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        provider: "google"
      })).toString("base64");

      res.redirect(`/account?token=${token}&user=${payload}`);
    } catch (err) {
      console.error("GOOGLE CALLBACK ERROR:", err);
      res.redirect("/account");
    }
  }
);

// ========================= CATEGORY DETAILS =========================
router.get("/category/:name", async (req, res) => {
  try {
    const [products] = await db.query(
      "SELECT * FROM products WHERE category = ?",
      [req.params.name]
    );

    res.render("pages/category", {
      title: req.params.name,
      products
    });
  } catch {
    res.render("pages/category", { title: req.params.name, products: [] });
  }
});

// ========================= PRODUCT DETAILS =========================
router.get("/product/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    const [rows] = await db.query(
      "SELECT * FROM products WHERE id = ?",
      [productId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).render("pages/404", { title: "Product not found" });
    }

    const product = rows[0];

    // Build images array from image1–image4
    const images = [
      product.image1,
      product.image2,
      product.image3,
      product.image4
    ].filter(Boolean);

    const [relatedProducts] = await db.query(
      "SELECT id, name, price, image1 FROM products WHERE category = ? AND id <> ? LIMIT 4",
      [product.category, product.id]
    );

    res.render("pages/product", {
      title: product.name,
      product,
      images,
      relatedProducts
    });

  } catch (err) {
    console.error("PRODUCT PAGE ERROR:", err);
    res.status(500).render("pages/500", { title: "Server error" });
  }
});


module.exports = router;
