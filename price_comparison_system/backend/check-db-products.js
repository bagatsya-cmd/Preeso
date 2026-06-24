const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ScrapedProduct = require('./src/models/scrapedProduct');

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing in environment variables');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const iphoneCount = await ScrapedProduct.countDocuments({ queryKey: 'iphone_15' });
  const s25Count = await ScrapedProduct.countDocuments({ queryKey: 'samsung_s25_edge_cover' });

  console.log(`iphone_15 count: ${iphoneCount}`);
  console.log(`samsung_s25_edge_cover count: ${s25Count}`);

  await mongoose.disconnect();
}

run().catch(console.error);
