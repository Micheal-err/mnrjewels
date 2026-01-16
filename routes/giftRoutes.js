const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* =========================
   🎁 GIFTS ROUTES
========================= */

router.get("/:type", async (req, res) => {
  try {
    const type = req.params.type;
    let where = ["p.is_gifting = 1"];
    let params = [];

    if (type === "for-him" || type === "for-her") {
      where.push("p.gifting_category = ?");
      params.push(type);
    }

   let having = [];

if (type === "under-1599") {
  having.push("MIN(v.price) <= 1599");
}

if (type === "from-699") {
  having.push("MIN(v.price) >= 699");
}


 const [rows] = await db.query(
  `
  SELECT 
    p.id,
    p.name,
    p.image1,
    p.is_gifting,
    MIN(v.price) AS price
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  WHERE ${where.join(" AND ")}
  GROUP BY p.id
  ${having.length ? `HAVING ${having.join(" AND ")}` : ""}
  ORDER BY p.id DESC
  `,
  params
);


    const titleMap = {
      "for-him": "Gifts for Him",
      "for-her": "Gifts for Her",
      "under-1599": "Gifts Under ₹1599",
      "from-699": "Gifts From ₹699"
    };

    res.render("pages/gifting", {
      categoryTitle: titleMap[type],
      collections: { All: rows },
      totalProducts: rows.length
    });

  } catch (err) {
    console.error("GIFTS ROUTE ERROR:", err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
