const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");

// ================= VIEW PARTIALS (AJAX) =================
router.get("/view/:section", adminAuth, (req, res) => {
  const section = req.params.section;

  const allowed = [
    "dashboard",
    "orders",
    "users",
    "allProducts",
    "allReviews",
       "newsletter",
  ];

  if (!allowed.includes(section)) {
    return res.status(404).send("Not found");
  }

  res.render(`admin/sections/${section}`, { layout: false });
});




module.exports = router;
