const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getWishlist, toggleWishlist } = require('../controllers/product');

router.get('/', authenticate, getWishlist);
router.post('/:id', authenticate, toggleWishlist);

module.exports = router;
