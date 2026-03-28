const cron = require('node-cron');
const User = require('../models/User');
const Product = require('../models/product');
const { searchAllPlatforms } = require('./scraper');

const startAlertService = () => {
  // Run every hour (for demo purposes we can change this or just keep it realistic)
  // Let's run it every 5 minutes in a real scenario, but 0 * * * * is every hour
  cron.schedule('*/5 * * * *', async () => {
    console.log('[AlertService] Checking price alerts...');
    try {
      const users = await User.find({ 'alerts.triggered': false });
      
      for (const user of users) {
        let updated = false;
        
        for (const alert of user.alerts) {
          if (alert.triggered) continue;
          
          const product = await Product.findById(alert.productId);
          if (!product) continue;
          
          // Use lowest price among all stores or specific store
          const currentPrice = product.lowestPrice;
          
          if (currentPrice && currentPrice <= alert.targetPrice) {
            console.log(`\n🔔 [ALERT TRIGGERED] User: ${user.email} | Product: ${alert.productName}`);
            console.log(`Target Price: ₹${alert.targetPrice} | Current Price: ₹${currentPrice}`);
            // Mock email sending
            console.log(`📧 Sending email to ${user.email}...\n`);
            
            alert.triggered = true;
            updated = true;
          }
        }
        
        if (updated) {
          await user.save();
        }
      }
    } catch (err) {
      console.error('[AlertService] Error checking alerts:', err);
    }
  });
  console.log('[AlertService] Started. Checking prices periodically.');
};

module.exports = { startAlertService };
