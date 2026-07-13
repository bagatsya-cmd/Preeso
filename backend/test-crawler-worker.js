const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ScrapeJob = require('./src/models/scrapeJob');
const ScrapedProduct = require('./src/models/scrapedProduct');
const ProductResult = require('./src/models/productResult');
const { generateUniqueHash } = require('./src/utils/deduplicator');
const { runAggregation } = require('./src/workers/aggregatorWorker');

async function runTest() {
  console.log('🏁 Starting Hybrid Crawler + Database Search System Test...');
  
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing in environment variables');
    process.exit(1);
  }
  
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // Clear test data
  console.log('🧹 Clearing test data collections...');
  await ScrapeJob.deleteMany({ queryKey: 'mouse_test' });
  await ScrapedProduct.deleteMany({ queryKey: 'mouse_test' });
  await ProductResult.deleteMany({ queryKey: 'mouse_test' });

  // 1. Create a scrape job
  console.log('📝 Creating a pending scrape job...');
  const job = await ScrapeJob.create({
    query: 'mouse',
    queryKey: 'mouse_test',
    status: 'pending'
  });
  console.log(`✅ Created scrape job with ID: ${job._id}`);

  // 2. Simulate Scraper Worker
  console.log('🤖 Simulating Scraper Worker...');
  job.status = 'scraping';
  await job.save();
  
  // Mock raw scraped products
  const mockRawProducts = [
    {
      title: 'Gaming Mouse RGB',
      price: 999,
      image: 'https://example.com/mouse1.jpg',
      link: 'https://www.flipkart.com/mouse1?ref=tracker123',
      platform: 'flipkart'
    },
    {
      title: 'Gaming Mouse RGB',
      price: 1099,
      image: 'https://example.com/mouse1.jpg',
      link: 'https://www.flipkart.com/mouse1?ref=tracker456', // URL contains different tracking parameter
      platform: 'flipkart'
    },
    {
      title: 'Office Wireless Mouse',
      price: 599,
      image: 'https://example.com/mouse2.jpg',
      link: 'https://www.amazon.in/mouse2',
      platform: 'amazon'
    }
  ];

  console.log('🧪 Inserting mock scraped products into scraped_products with deduplication...');
  const allScrapedItems = mockRawProducts.map(item => ({
    title: item.title,
    price: item.price,
    image: item.image,
    url: item.link,
    source: item.platform,
    queryKey: job.queryKey,
    scrapedAt: new Date(),
    uniqueHash: generateUniqueHash(item.title, item.link)
  }));

  const operations = allScrapedItems.map(item => ({
    updateOne: {
      filter: { uniqueHash: item.uniqueHash },
      update: { $set: item },
      upsert: true
    }
  }));

  await ScrapedProduct.bulkWrite(operations);

  // Check unique counts
  const rawDocs = await ScrapedProduct.find({ queryKey: 'mouse_test' });
  console.log(`📊 Total raw products written: ${rawDocs.length}`);
  
  // Expect 2 products: Gaming Mouse RGB (deduplicated due to url normalisation stripping query params) and Office Wireless Mouse
  if (rawDocs.length === 2) {
    console.log('✅ Deduplication verification passed! Duplicate product was successfully merged.');
  } else {
    console.error(`❌ Deduplication verification failed. Expected 2 docs, found ${rawDocs.length}.`);
    process.exit(1);
  }

  // Set job status to scraped
  job.status = 'scraped';
  await job.save();

  // 3. Simulate Aggregator Worker
  console.log('⚙️ Simulating Aggregator Worker...');
  job.status = 'aggregating';
  await job.save();

  await runAggregation(job);

  // Check product result
  const finalResult = await ProductResult.findOne({ queryKey: 'mouse_test' });
  if (finalResult && finalResult.products && finalResult.products.length > 0) {
    console.log(`✅ Aggregator verification passed! Compiled ${finalResult.products.length} grouped cards.`);
    console.log('Grouped Products details:', JSON.stringify(finalResult.products, null, 2));
  } else {
    console.error('❌ Aggregator verification failed. No grouped cards found in product_results.');
    process.exit(1);
  }

  // Set job status to completed
  job.status = 'completed';
  await job.save();
  console.log('🎉 All system validations completed successfully!');
  
  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
