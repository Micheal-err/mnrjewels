const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");

// RENDER STATIC HBS PARTIALS USED BY AJAX
router.get("/view/dashboard", adminAuth, (req, res) => {
    res.render("admin/dashboard", { layout: "admin" });
});

router.get("/view/users", adminAuth, (req, res) => {
    res.render("admin/sections/users", { layout: "admin" });
});

router.get("/view/allproducts", adminAuth, (req, res) => {
    res.render("admin/sections/allProducts", { layout: "admin" });
});

router.get("/view/orders", adminAuth, (req, res) => {
    res.render("admin/sections/orders", { layout: "admin" });
});

router.get("/view/reviews", adminAuth, (req, res) => {
    res.render("admin/sections/allReviews", { layout: "admin" });
});

router.get("/view/messages", adminAuth, (req, res) => {
    res.render("admin/sections/messages", { layout: "admin" });
});

router.get("/view/settings", adminAuth, (req, res) => {
    res.render("admin/sections/settings", { layout: "admin" });
});

module.exports = router;
