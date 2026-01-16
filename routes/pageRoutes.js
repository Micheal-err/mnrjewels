const express = require("express");
const router = express.Router();
const db = require("../config/db");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");
/* =========================
   HOME
========================= */
router.get("/", async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT 
        p.*,
        MIN(v.price) AS price
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
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

/* =========================
   CATEGORY LIST (GENERIC)
========================= */
router.get("/category", async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT 
        p.*,
        MIN(v.price) AS price
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
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

/* =========================
   CATEGORY BY NAME
========================= */
router.get("/category/:name", async (req, res) => {
  try {
    const category = req.params.name.toLowerCase();

    const [products] = await db.query(`
      SELECT 
        p.*,
        MIN(v.price) AS price
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      WHERE LOWER(p.category) = ?
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

/* =========================
   PRODUCT DETAILS
========================= */
router.get("/product/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    const [[product]] = await db.query(
      "SELECT * FROM products WHERE id = ?",
      [productId]
    );

    if (!product) {
      return res.status(404).render("pages/404", {
        title: "Product not found"
      });
    }

    const images = [
      product.image1,
      product.image2,
      product.image3,
      product.image4
    ].filter(Boolean);

    const [variants] = await db.query(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY price ASC",
      [productId]
    );

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

/* =========================
   STATIC PAGES
========================= */
router.get("/about", (req, res) =>
  res.render("pages/about", { title: "About Us" })
);

router.get("/contact", (req, res) =>
  res.render("pages/contact", { title: "Contact" })
);

/* =========================
   ACCOUNT / WISHLIST
========================= */
router.get("/account", (req, res) =>
  res.render("pages/account", { title: "My Account" })
);

router.get("/wishlist", (req, res) =>
  res.render("pages/wishlist", { title: "My Wishlist" })
);
// ===============================
// 🛒 CHECKOUT PAGE
// ===============================
router.get("/checkout", async (req, res) => {
  res.render("pages/checkout", {
    title: "Checkout"
  });
});

//terms
router.get("/terms", (req, res) => {
  res.render("pages/terms-condition", {
    title: "Terms & Conditions"
  });
});
router.get("/shipping-policy", (req, res) => {
  res.render("pages/shipping", {
    title: "Shipping Policy"
  });
});
router.get("/privacy-policy", (req, res) => {
  res.render("pages/privacy-policy", {
    title: "Privacy Policy"
  });
});
router.get("/refund-policy", (req, res) => {
  res.render("pages/refund-policy", {
    title: "Refund Policy"
  });
}); 
router.get("/product-care", (req, res) => {
  res.render("pages/product-care", {
    title: "Product Care"
  });
});
router.get("/faqs", (req, res) => {
  res.render("pages/faqs", {
    title: "Product Care"
  });
});
router.get("/about", (req, res) => {
  res.render("pages/about", {
    title: "About Us | M&R Jewels"
  });
});
router.get("/size-guide", (req, res) => {
  res.render("pages/sizeGuide", {
    title: "Rings Size Guide | M&R Jewels"
  });
});
router.get("/blogs/how-to-layer-silver-chains-the-right-way", (req, res) => {
  res.render("pages/how-to-layer-silver-chains-the-right-way", {
    title: "Rings Size Guide | M&R Jewels"
  });
});
router.get("/blogs/affordable-silver-gifts-under-1499-for-every-occasion", (req, res) => {
  res.render("pages/affordable-silver-gifts-under-1499-for-every-occasion", {
    title: "Rings Size Guide | M&R Jewels"
  });
});
router.get("/blogs/about-us-blog", (req, res) => {
  res.render("pages/about-us-blog", {
    title: "Rings Size Guide | M&R Jewels"
  });
});

router.get("/login", (req, res) => {
  return res.redirect("/account");
});

router.get("/signup", (req, res) => {
  return res.redirect("/account");
});




/* =========================
   SHOP ALL BY CATEGORY
   /shop/men
   /shop/women
   /shop/unisex
========================= */
router.get("/shop/:category", async (req, res) => {
  const category = req.params.category.toLowerCase();
  const isAjax = req.xhr;

  const { sort, price, finish } = req.query;

  let where = [`LOWER(p.category) = ?`];
  let params = [category];

  if (price) {
    const ranges = price.split(",");
    const cond = [];

    ranges.forEach(r => {
      if (r.includes("+")) {
        cond.push("v.price >= ?");
        params.push(Number(r.replace("+", "")));
      } else {
        const [min, max] = r.split("-").map(Number);
        cond.push("v.price BETWEEN ? AND ?");
        params.push(min, max);
      }
    });

    where.push(`(${cond.join(" OR ")})`);
  }

  if (finish) {
    const finishes = finish.split(",");
    where.push(`LOWER(v.finish) IN (${finishes.map(() => "?").join(",")})`);
    params.push(...finishes.map(f => f.toLowerCase()));
  }

  let orderBy = "p.id DESC";
  if (sort === "low") orderBy = "price ASC";
  if (sort === "high") orderBy = "price DESC";

  const [rows] = await db.query(`
    SELECT 
      p.id,
      p.name,
      p.image1,
      MIN(v.price) AS price
    FROM products p
    JOIN product_variants v ON v.product_id = p.id
    WHERE ${where.join(" AND ")}
    GROUP BY p.id
    ORDER BY ${orderBy}
  `, params);

  if (isAjax) {
    return res.json({
      products: rows,
      totalProducts: rows.length
    });
  }

  // ✅ SSR MUST MATCH SHOP-ALL
  res.render("pages/category", {
    categoryTitle: category,
    collections: { All: rows },
    totalProducts: rows.length
  });
});


/* =========================
   SHOP ALL (MEN + WOMEN + UNISEX)
   /shop/all
========================= */
router.get("/shop-all", async (req, res) => {
  const isAjax = req.xhr;

  const [rows] = await db.query(`
    SELECT 
      p.id,
      p.name,
      p.collection_name,
      p.image1,
      MIN(v.price) AS price
    FROM products p
    JOIN product_variants v ON v.product_id = p.id
    WHERE LOWER(p.category) IN ('men','women','unisex')
    GROUP BY p.id
    ORDER BY p.id DESC
  `);

  if (isAjax) {
    return res.json({
      products: rows,
      totalProducts: rows.length
    });
  }

  const collections = {};
  rows.forEach(p => {
    if (!collections[p.collection_name]) {
      collections[p.collection_name] = [];
    }
    collections[p.collection_name].push(p);
  });

  res.render("pages/category", {
    categoryTitle: "Shop All Jewellery",
    collections,
    totalProducts: rows.length
  });
});


/* =========================
   SHOP FILTER (AJAX + SSR)
========================= */
/* =========================
   SHOP PAGE (CATEGORY + OPTIONAL SUBCATEGORY)
   /shop/men
   /shop/men/rings
========================= */
router.get("/shop/:category/:subCategory?", async (req, res) => {
  const { category, subCategory } = req.params;
  const { sort, price, finish } = req.query;

  const isAjax =
    req.xhr ||
    req.headers.accept?.includes("application/json") ||
    req.query.ajax === "1";

  let where = ["LOWER(p.category) = ?"];
  let params = [category.toLowerCase()];

  // ✅ SUB CATEGORY (OPTIONAL)
  if (subCategory) {
    where.push("LOWER(p.sub_category) = ?");
    params.push(subCategory.toLowerCase());
  }

  // ✅ PRICE FILTER
  if (price) {
    const ranges = price.split(",");
    const priceConditions = [];

    ranges.forEach(r => {
      if (r.includes("+")) {
        priceConditions.push("v.price >= ?");
        params.push(Number(r.replace("+", "")));
      } else {
        const [min, max] = r.split("-").map(Number);
        priceConditions.push("v.price BETWEEN ? AND ?");
        params.push(min, max);
      }
    });

    where.push(`(${priceConditions.join(" OR ")})`);
  }

  // ✅ FINISH FILTER
  if (finish) {
    const finishes = finish.split(",");
    where.push(
      `LOWER(v.finish) IN (${finishes.map(() => "?").join(",")})`
    );
    params.push(...finishes.map(f => f.toLowerCase()));
  }

  // ✅ SORT
  let orderBy = "p.id DESC";
  if (sort === "low") orderBy = "price ASC";
  if (sort === "high") orderBy = "price DESC";

  const [rows] = await db.query(
    `
    SELECT 
      p.id,
      p.name,
      p.image1,
      MIN(v.price) AS price
    FROM products p
    JOIN product_variants v ON v.product_id = p.id
    WHERE ${where.join(" AND ")}
    GROUP BY p.id
    ORDER BY ${orderBy}
    `,
    params
  );

  if (isAjax) {
    return res.json({
      products: rows,
      totalProducts: rows.length
    });
  }

  res.render("pages/category", {
    collections: { All: rows },
    totalProducts: rows.length
  });
});
/* =========================
   SHOP (ALL PRODUCTS)
   /shop
========================= */
router.get("/shop", async (req, res) => {
  try {
    const isAjax =
      req.xhr ||
      req.headers.accept?.includes("application/json") ||
      req.query.ajax === "1";

    const { sort, price, finish } = req.query;

    let where = [];
    let params = [];

    // PRICE FILTER
    if (price) {
      const ranges = price.split(",");
      const priceConditions = [];

      ranges.forEach(r => {
        if (r.includes("+")) {
          priceConditions.push("v.price >= ?");
          params.push(Number(r.replace("+", "")));
        } else {
          const [min, max] = r.split("-").map(Number);
          priceConditions.push("v.price BETWEEN ? AND ?");
          params.push(min, max);
        }
      });

      where.push(`(${priceConditions.join(" OR ")})`);
    }

    // FINISH FILTER
    if (finish) {
      const finishes = finish.split(",");
      where.push(
        `LOWER(v.finish) IN (${finishes.map(() => "?").join(",")})`
      );
      params.push(...finishes.map(f => f.toLowerCase()));
    }

    // SORT
    let orderBy = "p.id DESC";
    if (sort === "low") orderBy = "price ASC";
    if (sort === "high") orderBy = "price DESC";

    const [rows] = await db.query(
      `
      SELECT 
        p.id,
        p.name,
        p.collection_name,
        p.image1,
        MIN(v.price) AS price
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY p.id
      ORDER BY ${orderBy}
      `,
      params
    );

    if (isAjax) {
      return res.json({
        products: rows,
        totalProducts: rows.length
      });
    }

    // GROUP BY COLLECTION (SSR EXPECTS THIS)
    const collections = {};
    rows.forEach(p => {
      if (!collections[p.collection_name || "All"]) {
        collections[p.collection_name || "All"] = [];
      }
      collections[p.collection_name || "All"].push(p);
    });

    res.render("pages/category", {
      categoryTitle: "Shop All Jewellery",
      collections,
      totalProducts: rows.length
    });

  } catch (err) {
    console.error("SHOP PAGE ERROR:", err);
    res.render("pages/category", {
      categoryTitle: "Shop",
      collections: {},
      totalProducts: 0
    });
  }
});


router.get("/shop/:category/collection/:collection", async (req, res) => {
  try {
    const { category, collection } = req.params;
    const { sort, price, finish } = req.query;

    const isAjax =
      req.xhr ||
      req.headers.accept?.includes("application/json") ||
      req.query.ajax === "1";

    let where = [
      "LOWER(p.category) = ?",
      "LOWER(REPLACE(p.collection_name, ' ', '-')) = ?"
    ];
    let params = [category.toLowerCase(), collection.toLowerCase()];

    if (price) {
      const ranges = price.split(",");
      const cond = [];

      ranges.forEach(r => {
        if (r.includes("+")) {
          cond.push("v.price >= ?");
          params.push(Number(r.replace("+", "")));
        } else {
          const [min, max] = r.split("-").map(Number);
          cond.push("v.price BETWEEN ? AND ?");
          params.push(min, max);
        }
      });

      where.push(`(${cond.join(" OR ")})`);
    }

    if (finish) {
      const finishes = finish.split(",");
      where.push(
        `LOWER(v.finish) IN (${finishes.map(() => "?").join(",")})`
      );
      params.push(...finishes.map(f => f.toLowerCase()));
    }

    let orderBy = "p.id DESC";
    if (sort === "low") orderBy = "price ASC";
    if (sort === "high") orderBy = "price DESC";

    const [rows] = await db.query(
      `
      SELECT 
        p.id,
        p.name,
        p.image1,
        MIN(v.price) AS price
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      WHERE ${where.join(" AND ")}
      GROUP BY p.id
      ORDER BY ${orderBy}
      `,
      params
    );

    if (isAjax) {
      return res.json({
        products: rows,
        totalProducts: rows.length
      });
    }

    res.render("pages/collection", {
      categoryTitle: `${category} / ${collection}`,
      collections: { [collection]: rows },
      totalProducts: rows.length
    });

  } catch (err) {
    console.error("COLLECTION PAGE ERROR:", err);
    res.render("pages/collection", {
      categoryTitle: "Collection",
      collections: {},
      totalProducts: 0
    });
  }
});


/* =========================
   AUTH (GOOGLE CALLBACK)
========================= */
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



/* =========================
   DEBUG
========================= */
router.get("/debug/cookie", (req, res) => {
  res.json({
    cookies: req.cookies,
    authHeader: req.headers.authorization || null
  });
});

module.exports = router;
