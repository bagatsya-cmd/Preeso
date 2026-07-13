const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ScrapedProduct = require('./src/models/scrapedProduct');
const matchingService = require('./src/services/matchingService');

// Map database source names to display retailer names expected by matchingService
const PLATFORM_NAME_MAP = {
  amazon:          'Amazon',
  flipkart:        'Flipkart',
  myntra:          'Myntra',
  reliance:        'Reliance Digital',
  ajio:            'AJIO',
  nykaa:           'Nykaa',
};

async function runDiagnosticsForQuery(query, queryKey) {
  console.log('\n' + '='.repeat(80));
  console.log(`DIAGNOSTICS FOR QUERY: "${query}" (queryKey: "${queryKey}")`);
  console.log('='.repeat(80));

  const rawDocs = await ScrapedProduct.find({ queryKey }).lean();
  console.log(`Loaded ${rawDocs.length} raw scraped documents from database.`);

  const formattedRaw = rawDocs.map((doc) => ({
    title: doc.title,
    price: doc.price,
    image: doc.image || null,
    link: doc.url,
    platform: PLATFORM_NAME_MAP[doc.source.toLowerCase()] || doc.source,
    brand: 'Unknown',
    category: 'General'
  }));

  const result = matchingService.mergeProducts(formattedRaw, query);

  console.log(`\n--- Completed Diagnostics for "${query}" ---`);
  console.log(`Final Cards Count: ${result.length}`);
  console.log('-'.repeat(80));
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing in environment variables');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  await runDiagnosticsForQuery('iphone 15', 'iphone_15');
  await runDiagnosticsForQuery('samsung s25 edge cover', 'samsung_s25_edge_cover');

  await mongoose.disconnect();
}

run().catch(console.error);
