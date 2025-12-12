const db = require('../config/db');

const Product = {
  // Use async/await with promise-based pool
  getAll: async () => {
    try {
      const [rows] = await db.query('SELECT * FROM products');
      return rows;
    } catch (error) {
      console.error('Error in Product.getAll:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error in Product.getById:', error);
      throw error;
    }
  },
  
  create: async (data) => {
    try {
      const [result] = await db.query('INSERT INTO products SET ?', data);
      return { insertId: result.insertId };
    } catch (error) {
      console.error('Error in Product.create:', error);
      throw error;
    }
  },
  
  update: async (id, data) => {
    try {
      const [result] = await db.query('UPDATE products SET ? WHERE id = ?', [data, id]);
      return result;
    } catch (error) {
      console.error('Error in Product.update:', error);
      throw error;
    }
  },
  
  delete: async (id) => {
    try {
      const [result] = await db.query('DELETE FROM products WHERE id = ?', [id]);
      return result;
    } catch (error) {
      console.error('Error in Product.delete:', error);
      throw error;
    }
  }
};

module.exports = Product;