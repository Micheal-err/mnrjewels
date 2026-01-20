require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");
const { engine } = require("express-handlebars");

const app = express();

/* ===============================
   TRUST PROXY (REQUIRED ON RENDER)
================================ */
app.set("trust proxy", 1);

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
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "https://your-site.onrender.com",
        "https://your-domain.com"
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked"));
      }
    },
    credentials: true
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   SESSION (PRODUCTION SAFE)
================================ */
app.use(
  session({
    name: "session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  })
);

/* ===============================
   PASSPORT
================================ */
app.use(passport.initialize());
app.use(passport.session());

/* ===============================
   STATIC FILES
================================ */
app.use(express.static(path.join(__dirname, "public")));

/*
⚠️ IMPORTANT:
Render filesystem is ephemeral.
Only keep this if files are static/seeded.
For uploads → use Cloudinary / S3
*/
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
app.use("/newsletter", require("./routes/newsletter"));
app.use("/api", require("./routes/searchRoutes"));

// 🛒 CART + CHECKOUT
app.use("/cart", require("./routes/cartRoutes"));
app.use("/checkout", require("./routes/checkoutRoutes"));

// 🎁 GIFTS
app.use("/gifting", require("./routes/giftRoutes"));

// 🌐 PUBLIC PAGES (LAST)
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
