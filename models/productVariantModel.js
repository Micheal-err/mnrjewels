const db = require('../config/db');

const ProductVariant = {
  // Get variants by product
  getByProductId: (productId) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM product_variants WHERE product_id = ?",
        [productId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });
  },

  // Create variant
  create: (data) => {
    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO product_variants SET ?",
        data,
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
  },

  // Update variant
  update: (id, data) => {
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE product_variants SET ? WHERE id = ?",
        [data, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // Delete variant
  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "DELETE FROM product_variants WHERE id = ?",
        [id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

module.exports = ProductVariant;
