require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const passport = require("./config/passport");
const { engine } = require("express-handlebars");

const app = express();

/* ===============================
   HANDLEBARS
================================ */
app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
      json: (context) => JSON.stringify(context),
      formatPrice: (value) => {
        if (value === null || value === undefined) return "0";
        const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
        return isNaN(num) ? "0" : num.toLocaleString("en-IN");
      }
    }
  })
);

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

/* ===============================
   CORE MIDDLEWARE
================================ */
app.use(cors({
  origin: true,        // allows localhost + IP + domain
  credentials: true    // REQUIRED for cookies
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   PASSPORT (NO SESSIONS)
   Only for OAuth callbacks
================================ */
app.use(passport.initialize());

/* ===============================
   STATIC FILES
================================ */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

/* ===============================
   ROUTES (ORDER MATTERS)
================================ */

// 🔐 ADMIN
app.use("/admin", require("./routes/adminRoutes"));

// 🌐 AUTH
app.use("/auth", require("./routes/authRoutes"));
app.use("/auth", require("./routes/authSocialRoutes"));

// 🌐 API
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/product-variants", require("./routes/productVariantRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/coupons", require("./routes/couponsRoutes"));

// 🛒 CART + CHECKOUT
app.use("/cart", require("./routes/cartRoutes"));
app.use("/checkout", require("./routes/checkoutRoutes"));

// 🌐 PUBLIC PAGES (LAST)
// 🎁 GIFTS (CLEAN & ISOLATED)
app.use("/gifting", require("./routes/giftRoutes"));
app.use("/", require("./routes/pageRoutes"));

/* ===============================
   404
================================ */
app.use((req, res) => {
  res.status(404).send("Not Found");
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
