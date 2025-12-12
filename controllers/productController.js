const Product = require('../models/productModel');

exports.getProducts = async (req, res) => {
  try {
    const results = await Product.getAll();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const result = await Product.getById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE PRODUCT WITH IMAGES
exports.createProduct = async (req, res) => {
  try {
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

    const result = await Product.create(data);
    res.json({ message: "Product created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE PRODUCT WITH OPTIONAL IMAGES
exports.updateProduct = async (req, res) => {
  try {
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

    await Product.update(req.params.id, updateData);
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.delete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};