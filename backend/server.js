const mongoose = require('mongoose');
const cron = require('node-cron');
require('dotenv').config();

const app = require('./src/app');
const { startWorkers } = require('./src/utils/workerManager');
const { SCRAPING_ENABLED } = require('./src/config/features');

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    console.log(`[Server] SCRAPING_ENABLED=${SCRAPING_ENABLED}`);

    if (SCRAPING_ENABLED) {
      startWorkers();
    } else {
      console.log('[Server] Scraping disabled — workers will not start.');
    }

    // Only start standard server if NOT on Vercel
    if (!process.env.VERCEL) {
        startServer();
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('Starting server without database (limited functionality)...');
    if (!process.env.VERCEL) {
        startServer();
    }
  });

function startServer() {
  const PORT = process.env.PORT || 5000;
  console.log('[SERVER HOST]', '0.0.0.0');
  console.log('[SERVER PORT]', PORT);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Preeso backend running on http://127.0.0.1:${PORT}`);
  });

  // Only schedule scraping-related cron jobs when scraping is enabled
  if (SCRAPING_ENABLED) {
    // Cron: check price alerts every hour
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ Running price alert check...');
      const { checkAlerts } = require('./src/services/alerts');
      await checkAlerts();
    });

    // Cron: refresh popular product prices every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('🔄 Refreshing product prices...');
      const Product = require('./src/models/product');
      const { searchAllPlatforms } = require('./src/services/scraper');
      const recentProducts = await Product.find({}).sort({ lastUpdated: 1 }).limit(20);
      for (const product of recentProducts) {
        if (product.searchQuery) {
          const fresh = await searchAllPlatforms(product.searchQuery);
          if (fresh && fresh.length > 0) {
            const match = fresh.find(p => p.name === product.name) || fresh[0];
            if (match && match.stores) {
              product.stores = match.stores;
              await product.save();
            }
          }
        }
      }
      console.log('✅ Price refresh complete');
    });
  } else {
    console.log('[Server] Scraping disabled — cron jobs will not start.');
  }
}

// CRITICAL FOR VERCEL: Export the Express app so Vercel can pass requests to it
module.exports = app;