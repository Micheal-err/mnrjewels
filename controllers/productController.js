const Product = require('../models/productModel');

exports.getProducts = (req, res) => {
  Product.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

exports.getProduct = (req, res) => {
  Product.getById(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results[0]);
  });
};

// CREATE PRODUCT WITH IMAGES
exports.createProduct = (req, res) => {
  const data = { ...req.body };

  // Images
  if (req.files) {
    data.image1 = req.files.image1?.[0]?.filename || null;
    data.image2 = req.files.image2?.[0]?.filename || null;
    data.image3 = req.files.image3?.[0]?.filename || null;
    data.image4 = req.files.image4?.[0]?.filename || null;
  }

  // Fix collection
  if (data.collection) {
    data.collection_name = data.collection;
    delete data.collection;
  }

  console.log("INSERT DATA:", data);

  Product.create(data, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Product created", id: results.insertId });
  });
};




// UPDATE PRODUCT WITH OPTIONAL IMAGES
exports.updateProduct = (req, res) => {
  const body = req.body;

  const mainImage = req.files?.main_image ? req.files.main_image[0].filename : null;
  const otherImages = req.files?.images
    ? req.files.images.map(img => img.filename)
    : [];

  const updateData = {
    ...body,
  };

  if (otherImages[0]) updateData.image1 = otherImages[0];
  if (otherImages[1]) updateData.image2 = otherImages[1];
  if (otherImages[2]) updateData.image3 = otherImages[2];
  if (otherImages[3]) updateData.image4 = otherImages[3];

  Product.update(req.params.id, updateData, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Product updated' });
  });
};

exports.deleteProduct = (req, res) => {
  Product.delete(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Product deleted' });
  });
};
