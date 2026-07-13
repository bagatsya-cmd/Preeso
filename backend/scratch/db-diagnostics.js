const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ScrapedProduct = require('../src/models/scrapedProduct');

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // Count by source
  const stats = await ScrapedProduct.aggregate([
    { $group: { _id: "$source", count: { $sum: 1 } } }
  ]);
  console.log('Product counts by source:');
  console.log(stats);

  // Distinct queryKeys
  const queries = await ScrapedProduct.distinct('queryKey');
  console.log('\nDistinct queryKeys:', queries);

  // Sample data per source
  for (const stat of stats) {
    const source = stat._id;
    console.log(`\n--- Samples for ${source} (1 sample) ---`);
    const samples = await ScrapedProduct.find({ source }).limit(1).lean();
    console.log(samples);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
