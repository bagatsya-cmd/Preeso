const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ScrapedProduct = require('./src/models/scrapedProduct');
const MatchingService = require('./src/services/matchingService');
const matcher = MatchingService;

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/price_comparison';
  console.log(`Connecting to MongoDB at: ${mongoUri}`);
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Fetch 10 scraped products
    const rawProducts = await ScrapedProduct.find({}).limit(10).lean();
    console.log(`Fetched ${rawProducts.length} raw products from DB.`);

    if (rawProducts.length === 0) {
      console.log('No products found in DB. Scraping/seeding might be required.');
      await mongoose.disconnect();
      return;
    }

    // Force DEBUG_RAW_MODE to true
    process.env.DEBUG_RAW_MODE = 'true';

    console.log('\n--- Normal Raw Products (First 10) ---');
    rawProducts.forEach((p, idx) => {
      console.log(`Raw [${idx+1}]:`);
      console.log(`  Title:      ${p.title}`);
      console.log(`  image:      ${p.image}`);
      console.log(`  url:        ${p.url}`);
    });

    console.log('\n--- Running mergeProducts in DEBUG_RAW_MODE = true ---');
    // We pass normalized form where source is platform
    const normalizedRaw = rawProducts.map(p => ({
      ...p,
      platform: p.source,
      price: p.price,
      originalPrice: p.price,
      link: p.url,
    }));

    const results = matcher.mergeProducts(normalizedRaw);

    console.log('\n--- Output Products (First 10) ---');
    results.forEach((p, idx) => {
      console.log(`Mapped [${idx+1}]:`);
      console.log(`  baseName:        ${p.baseName}`);
      console.log(`  image:           ${p.image}`);
      console.log(`  imageUrl:        ${p.imageUrl}`);
      console.log(`  stores[0].image: ${p.stores?.[0]?.image}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
