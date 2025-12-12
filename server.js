require("dotenv").config();
const express = require("express");
const passport = require("./config/passport"); // adjust if needed
const session = require('express-session');
const app = express();
const path = require("path");
const hbs = require("hbs");
const { engine } = require("express-handlebars");

// routes
const authRoutes = require("./routes/authRoutes");
const authSocialRoutes = require('./routes/authSocialRoutes');
const reviewRoutes = require("./routes/reviewRoutes");
const contactRoutes = require("./routes/contactRoutes"); // ensure file exists
// admin routes
const adminPages = require("./routes/adminPages");
const adminRoutes = require("./routes/adminRoutes");

// Handlebars engine
app.engine("hbs", engine({
  extname: ".hbs",
  defaultLayout: "main",
  layoutsDir: path.join(__dirname, "views/layouts"),
  partialsDir: path.join(__dirname, "views/partials")
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
hbs.registerPartials(path.join(__dirname, "views/partials"));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // must be present for JSON POSTs

// Session + passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'some_session_secret',
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(authSocialRoutes);

// Static folders
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Routes - public & api
app.use("/", require("./routes/pageRoutes"));          // page routes
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/auth", authRoutes);
app.use("/contact", contactRoutes);                    // <--- contact routes mounted here
app.use("/api/reviews", reviewRoutes);

// Admin routes
app.use("/admin", adminPages);
app.use("/admin", adminRoutes);

// If you had accidentally mounted reviewRoutes to "/" again, remove that duplicate.
// (The following duplicate was removed in this corrected file in case your previous file had it)
// app.use("/", reviewRoutes);  // <<-- removed duplicate

// Fallback 404 (optional)
app.use((req, res) => {
  res.status(404).send("Not found");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
