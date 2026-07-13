const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ScrapedProduct = require('../src/models/scrapedProduct');

async function run() {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const sources = ['flipkart', 'myntra', 'ajio', 'reliance', 'nykaa', 'amazon'];
  console.log('\n=========================================');
  console.log('IMAGE EXTRACTION AUDIT REPORT');
  console.log('=========================================');

  for (const src of sources) {
    const total = await ScrapedProduct.countDocuments({ source: src });
    const hasImage = await ScrapedProduct.countDocuments({
      source: src,
      image: { $ne: null, $exists: true }
    });

    // Check for empty string images as well
    const emptyDocs = await ScrapedProduct.countDocuments({
      source: src,
      image: ''
    });

    const successCount = hasImage - emptyDocs;
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(2) : 'N/A';

    console.log(`Retailer: ${src.toUpperCase()}`);
    console.log(`  Total Products Scraped: ${total}`);
    console.log(`  Images Extracted:       ${successCount}`);
    console.log(`  Success %:              ${successRate}%`);
    if (emptyDocs > 0) {
      console.log(`  Empty string images:    ${emptyDocs}`);
    }
    console.log('');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
