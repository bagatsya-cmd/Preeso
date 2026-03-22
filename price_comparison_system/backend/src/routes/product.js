const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/product');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/search', ctrl.searchProducts);
router.get('/trending', ctrl.getTrending);
router.get('/:id', ctrl.getProductById);

// Auth-protected routes
router.post('/:id/alert', authenticate, ctrl.setAlert);
router.get('/user/alerts', authenticate, ctrl.getUserAlerts);

module.exports = router;