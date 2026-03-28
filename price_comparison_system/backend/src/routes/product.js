const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/product');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/search', ctrl.searchProducts);
router.get('/trending', ctrl.getTrending);

// Auth-protected static routes
router.get('/user/alerts', authenticate, ctrl.getUserAlerts);
router.get('/user/recommendations', authenticate, ctrl.getRecommendations);
router.post('/history/search', authenticate, ctrl.recordSearch);

// Parameterized routes (put these last to avoid overshadowing)
router.get('/:id', ctrl.getProductById);
router.post('/:id/alert', authenticate, ctrl.setAlert);
router.post('/history/view/:id', authenticate, ctrl.recordView);

module.exports = router;