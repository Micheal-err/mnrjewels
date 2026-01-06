require("dotenv").config();
const express = require("express");
const passport = require("./config/passport");
const session = require("express-session");
const path = require("path");
const cookieParser = require("cookie-parser");
const { engine } = require("express-handlebars");

const app = express();

/* ===============================
   HANDLEBARS (CORRECT WAY)
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

        const cleaned = value.toString().replace(/[^\d.]/g, "");
        const number = parseFloat(cleaned);

        if (isNaN(number)) return "0";

        return number.toLocaleString("en-IN");
      }
    }
  })
);


app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

/* ===============================
   MIDDLEWARE
================================ */
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "some_session_secret",
    resave: false,
    saveUninitialized: false
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* ===============================
   STATIC FILES
================================ */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
/* ===============================
   ROUTES (CORRECT ORDER)
================================ */

// 🔐 ADMIN FIRST
app.use("/admin", require("./routes/adminRoutes"));

// 🌐 PUBLIC PAGES AFTER
app.use("/", require("./routes/pageRoutes"));

app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/product-variants", require("./routes/productVariantRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/auth", require("./routes/authRoutes"));
app.use("/auth", require("./routes/authSocialRoutes"));
app.use("/contact", require("./routes/contactRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/cart", require("./routes/cartRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/coupons", require("./routes/couponsRoutes"));
app.use("/checkout", require("./routes/checkoutRoutes"));  
/* ===============================
   404
================================ */
app.use((req, res) => {
  res.status(404).send("Not found");
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
