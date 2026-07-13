const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ScrapedProduct = require('../src/models/scrapedProduct');

async function run() {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const sources = ['nykaa', 'flipkart', 'myntra', 'ajio', 'reliance', 'amazon'];
  for (const src of sources) {
    console.log(`\n==================== ${src.toUpperCase()} (20 Samples) ====================`);
    const docs = await ScrapedProduct.find({ source: src }).limit(20).lean();
    console.log(`Total found in database for ${src}: ${await ScrapedProduct.countDocuments({ source: src })}`);
    docs.forEach((doc, idx) => {
      console.log(`[${idx + 1}] Title: "${doc.title}"`);
      console.log(`    Price: ${doc.price} | QueryKey: "${doc.queryKey}"`);
      console.log(`    URL: ${doc.url}`);
    });
  }

  await mongoose.disconnect();
}

run().catch(console.error);
