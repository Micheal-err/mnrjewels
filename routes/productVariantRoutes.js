const express = require('express');
const router = express.Router();
const variantController = require('../controllers/productVariantController');

// get variants for a product
router.get('/product/:productId', variantController.getVariantsByProduct);

// create variant
router.post('/', variantController.createVariant);

// update variant
router.put('/:id', variantController.updateVariant);

// delete variant
router.delete('/:id', variantController.deleteVariant);

module.exports = router;
