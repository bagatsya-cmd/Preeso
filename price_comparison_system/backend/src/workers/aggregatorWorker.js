const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ScrapeJob = require('../models/scrapeJob');
const ScrapedProduct = require('../models/scrapedProduct');
const ProductResult = require('../models/productResult');
const matchingService = require('../services/matchingService');
const pubSub = require('../utils/pubSub');

const PLATFORM_NAME_MAP = {
  amazon:          'Amazon',
  flipkart:        'Flipkart',
  myntra:          'Myntra',
  reliance:        'Reliance Digital',
  ajio:            'AJIO',
  nykaa:           'Nykaa',
};

async function runAggregation(job) {
  const query = job.query;
  const queryKey = job.queryKey;
  
  console.log("aggregationStarted");
  console.log(`[AggregatorWorker] Aggregating raw results for queryKey: "${queryKey}"`);
  
  // Fetch raw scraped products for queryKey
  const rawScraped = await ScrapedProduct.find({ queryKey }).lean();
  console.log(`[AggregatorWorker] Found ${rawScraped.length} raw items in scraped_products`);
  console.log(`[PIPELINE-TRACE] Stage 1 (DB Read): ${rawScraped.length} raw scraped products for queryKey="${queryKey}"`);
  
  // Map raw DB docs into the format expected by matchingService
  const formattedRaw = rawScraped.map((doc) => ({
    title: doc.title,
    price: doc.price,
    image: doc.image || null,
    link: doc.url,
    platform: PLATFORM_NAME_MAP[doc.source.toLowerCase()] || doc.source,
    brand: 'Unknown',
    category: 'General'
  }));

  // Perform fuzzy matching and grouping
  const groupedCards = matchingService.mergeProducts(formattedRaw, query);
  console.log(`[PIPELINE-TRACE] Stage 2 (mergeProducts output): ${groupedCards.length} cards returned by matchingService`);
  
  // Compute aggregated fields
  const lowestPrice = groupedCards.length > 0
    ? Math.min(...groupedCards.map((p) => p.lowestPrice || Infinity))
    : null;
  const imageUrl = groupedCards.length > 0
    ? (groupedCards[0].imageUrl || groupedCards[0].image || null)
    : null;

  // Save/Upsert grouped results to product_results
  const savedResult = await ProductResult.findOneAndUpdate(
    { queryKey },
    {
      queryKey,
      products: groupedCards,
      lowestPrice: isFinite(lowestPrice) ? lowestPrice : null,
      imageUrl,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
  console.log(`[PIPELINE-TRACE] Stage 3 (DB Save): ${savedResult?.products?.length ?? 'N/A'} products saved to product_results for queryKey="${queryKey}"`);

  console.log("aggregationFinished");
  console.log(`[AggregatorWorker] Grouped results saved to product_results.`);

  // Publish update event via Pub/Sub for active SSE connections
  const pubSubPayload = {
    type: 'partial-results',
    products: groupedCards,
    final: true
  };
  console.log(`[PIPELINE-TRACE] Stage 4 (PubSub Emit): Publishing ${groupedCards.length} products to channel "search:update:${queryKey}"`);  
  await pubSub.publish(`search:update:${queryKey}`, pubSubPayload);
  
  console.log("PubSub emitted");
  console.log(`[AggregatorWorker] Published update event for queryKey: "${queryKey}"`);
}

async function startWorker() {
  console.log('[AggregatorWorker] Worker loop started...');
  
  try {
    // Recovery logic on startup: reset jobs stuck in 'aggregating' for >2 minutes back to 'scraped'
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recovered = await ScrapeJob.updateMany(
      { status: 'aggregating', updatedAt: { $lt: twoMinutesAgo } },
      { $set: { status: 'scraped', updatedAt: new Date() } }
    );
    if (recovered.modifiedCount > 0) {
      console.log(`[AggregatorWorker] Cleaned up ${recovered.modifiedCount} stuck aggregating jobs back to scraped.`);
    }
  } catch (err) {
    console.error('[AggregatorWorker] Startup recovery failed:', err.message);
  }
  
  while (true) {
    try {
      // Find a job that needs incremental aggregation OR is ready for final aggregation
      const job = await ScrapeJob.findOne({
        $or: [
          { status: 'scraped' },
          { needsAggregation: true },
          { 
            status: 'aggregating', 
            updatedAt: { $lt: new Date(Date.now() - 60 * 1000) } // stuck > 1 minute
          }
        ]
      }).sort({ updatedAt: 1 });

      if (job) {
        // Atomically lock and clear needsAggregation flag
        const updateObj = { needsAggregation: false, updatedAt: new Date() };
        if (job.status === 'scraped') {
          updateObj.status = 'aggregating';
        }
        
        const lockedJob = await ScrapeJob.findOneAndUpdate(
          { _id: job._id },
          { $set: updateObj },
          { new: true }
        );

        if (lockedJob) {
          try {
            console.log("Aggregation started");
            console.log(`[AggregatorWorker] Aggregation started for queryKey: "${lockedJob.queryKey}"`);
            
            await runAggregation(lockedJob);
            
            // If the job was scraped/aggregating, complete it
            if (lockedJob.status === 'aggregating') {
              lockedJob.status = 'completed';
              lockedJob.updatedAt = new Date();
              await lockedJob.save();
              console.log(`[AggregatorWorker] Job successfully completed for queryKey: "${lockedJob.queryKey}"`);
            }
          } catch (err) {
            console.error(`[AggregatorWorker] Aggregation failed for job ${lockedJob._id}:`, err);
            if (lockedJob.status === 'aggregating') {
              lockedJob.status = 'failed';
              lockedJob.error = err.message;
              lockedJob.updatedAt = new Date();
              await lockedJob.save();
            }
          }
        }
      } else {
        // No jobs to aggregate, sleep for 1 second
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error('[AggregatorWorker] Error in polling loop:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Connect to MongoDB and run
if (require.main === module) {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not specified in environment.');
    process.exit(1);
  }
  
  console.log('[AggregatorWorker] Connecting to MongoDB...');
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('✅ Connected to MongoDB');
      startWorker();
    })
    .catch((err) => {
      console.error('❌ Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });
}

module.exports = { runAggregation };
