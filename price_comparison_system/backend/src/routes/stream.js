const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');

// GET /api/stream/search?q=
router.get('/search', streamController.streamSearch);

module.exports = router;
