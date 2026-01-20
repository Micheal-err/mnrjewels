const express = require("express");
const router = express.Router();
const { searchProducts } = require("../controllers/searchController");

// 🔍 Product search
router.get("/products/search", searchProducts);

module.exports = router;
