const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Home
router.get("/", (req, res) => {
  db.query("SELECT * FROM products LIMIT 12", (err, products) => {
    res.render("pages/index", { title: "Home", products });
  });
});

router.get("/category", (req, res) => {
  db.query("SELECT * FROM products LIMIT 12", (err, products) => {
    res.render("pages/category", { title: "Category", products });
  });
});

// About
router.get("/about", (req, res) => {
  res.render("pages/about", { title: "About Us" });
});

// Contact
router.get("/contact", (req, res) => {
  res.render("pages/contact", { title: "Contact" });
});

// Category Page
router.get("/category/:name", (req, res) => {
  db.query(
    "SELECT * FROM products WHERE category = ?",
    [req.params.name],
    (err, products) => {
      res.render("pages/category", {
        title: req.params.name,
        products
      });
    }
  );
});

// Product Details
router.get("/product/:id", (req, res) => {
  db.query(
    "SELECT * FROM products WHERE id = ?",
    [req.params.id],
    (err, result) => {
      res.render("pages/product-details", { product: result[0] });
    }
  );
});

module.exports = router;
