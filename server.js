const express = require("express");
const app = express();
const path = require("path");
const hbs = require("hbs");
const { engine } = require("express-handlebars");
require("dotenv").config();

// Body Parsers
app.engine("hbs", engine({
  extname: ".hbs",
  defaultLayout: "main",       // <-- IMPORTANT
  layoutsDir: path.join(__dirname, "views/layouts"), 
  partialsDir: path.join(__dirname, "views/partials")
}));

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
// Register Partials ONLY from partials folder
hbs.registerPartials(path.join(__dirname, "views/partials"));

// Static folder
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
44
// Routes
app.use("/", require("./routes/pageRoutes"));
app.use("/api/products", require("./routes/productRoutes"));

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
