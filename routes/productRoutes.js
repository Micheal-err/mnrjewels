const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../middleware/upload');

router.post('/', upload, productController.createProduct);
router.put('/:id', upload, productController.updateProduct);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
