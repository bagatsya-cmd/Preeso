const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');  // For scalability

const app = express();
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));  // 100 requests per 15 min

// Routes
app.use('/api/products', require('./routes/product'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wishlist', require('./routes/wishlist'));

// Start services
const { startAlertService } = require('./services/alertService');
startAlertService();

module.exports = app;