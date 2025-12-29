const hbs = require("hbs");

hbs.registerHelper("formatPrice", function (value) {
  if (value === null || value === undefined) return "0";

  const cleaned = value.toString().replace(/[^\d.]/g, "");
  const number = parseFloat(cleaned);

  if (isNaN(number)) return "0";

  return number.toLocaleString("en-IN");
});
