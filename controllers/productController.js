const Product = require('../models/productModel');

/**
 * GET ALL PRODUCTS
 */
exports.getProducts = async (req, res) => {
  try {
    const results = await Product.getAll();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET SINGLE PRODUCT (PRODUCT ONLY – VARIANTS FETCHED SEPARATELY)
 */
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * CREATE PRODUCT (DESIGN + IMAGES ONLY)
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      sub_category,
      collection,
      category_description,
      metal,
      diamonds,
      gemstones_color
    } = req.body;

    const data = {
      name,
      description,
      category,
      sub_category,
      collection_name: collection || null,
      category_description,
      metal,
      diamonds,
      gemstones_color
    };

    // Product-level images only
    if (req.files) {
      data.image1 = req.files.image1?.[0]?.filename || null;
      data.image2 = req.files.image2?.[0]?.filename || null;
      data.image3 = req.files.image3?.[0]?.filename || null;
      data.image4 = req.files.image4?.[0]?.filename || null;
    }

    const result = await Product.create(data);

    res.json({
      message: "Product created successfully",
      product_id: result.insertId
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * UPDATE PRODUCT (DESIGN + IMAGES ONLY)
 */
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      sub_category,
      collection,
      category_description,
      metal,
      diamonds,
      gemstones_color
    } = req.body;

    const updateData = {
      name,
      description,
      category,
      sub_category,
      collection_name: collection || null,
      category_description,
      metal,
      diamonds,
      gemstones_color
    };

    // Update images only if provided
    if (req.files) {
      const images = req.files.images || [];
      if (images[0]) updateData.image1 = images[0].filename;
      if (images[1]) updateData.image2 = images[1].filename;
      if (images[2]) updateData.image3 = images[2].filename;
      if (images[3]) updateData.image4 = images[3].filename;
    }

    await Product.update(req.params.id, updateData);

    res.json({ message: "Product updated successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE PRODUCT
 * (Variants auto-deleted via FK CASCADE)
 */
exports.deleteProduct = async (req, res) => {
  try {
    await Product.delete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
