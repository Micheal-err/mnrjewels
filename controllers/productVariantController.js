const ProductVariant = require('../models/productVariantModel');

exports.getVariantsByProduct = async (req, res) => {
  try {
    const variants = await ProductVariant.getByProductId(req.params.productId);
    res.json(variants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createVariant = async (req, res) => {
  try {
    const {
      product_id,
      sku,
      price,
      length_size,
      width,
      thickness,
      finish,
      stock
    } = req.body;

    if (!product_id || !sku || !price) {
      return res.status(400).json({ error: "product_id, sku and price are required" });
    }

    const data = {
      product_id,
      sku,
      price,
      length_size: length_size || null,
      width: width || null,
      thickness: thickness || null,
      finish: finish || null,
      stock: stock || 0
    };

    const result = await ProductVariant.create(data);

    res.json({
      message: "Variant created",
      variant_id: result.insertId
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateVariant = async (req, res) => {
  try {
    await ProductVariant.update(req.params.id, req.body);
    res.json({ message: "Variant updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteVariant = async (req, res) => {
  try {
    await ProductVariant.delete(req.params.id);
    res.json({ message: "Variant deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
