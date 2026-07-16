const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { SCRAPING_ENABLED } = require('../config/features');

const ScrapeJob = require('../models/scrapeJob');
const ScrapedProduct = require('../models/scrapedProduct');
const { generateUniqueHash, generateSoftHash } = require('../utils/deduplicator');
const { scoreProduct } = require('../utils/catalogQuality');

const ActiveCatalog = require('../models/activeCatalog');
const matchingService = require('../services/matchingService');
const pubSub = require('../utils/pubSub');

// Import approved scrapers
const flipkartScraper = require('../scrapers/flipkart');
const myntraScraper = require('../scrapers/myntra');
const ajioScraper = require('../scrapers/ajio');
const nykaaScraper = require('../scrapers/nykaa');
const relianceScraper = require('../scrapers/reliance');

const APPROVED_PLATFORMS = [
  { name: 'flipkart', scraper: flipkartScraper },
  { name: 'myntra', scraper: myntraScraper },
  { name: 'ajio', scraper: ajioScraper },
  { name: 'nykaa', scraper: nykaaScraper },
  { name: 'reliance', scraper: relianceScraper }
];
const cancellationManager = require('../utils/cancellationManager');

async function runScraping(job) {
  const query = job.query;
  const queryKey = job.queryKey;
  const jobId = job._id;
  const scrapeJobId = jobId.toString();
  
  console.log("scrapeStarted");
  console.log("Active retailers:", APPROVED_PLATFORMS.length);
  console.log(`[GENERATION START] queryKey="${queryKey}" scrapeJobId="${scrapeJobId}"`);
  console.log(`[ScraperWorker] Starting parallel scrape for query: "${query}" (queryKey: "${queryKey}")`);
  
  let totalFetched = 0;
  let totalInserted = 0;
  let cancelled = false;

  const PLATFORM_NAME_MAP = {
    amazon:          'Amazon',
    flipkart:        'Flipkart',
    myntra:          'Myntra',
    reliance:        'Reliance Digital',
    ajio:            'AJIO',
    nykaa:           'Nykaa',
  };

  // Execute scrapers concurrently and process outcomes incrementally
  const scrapePromises = APPROVED_PLATFORMS.map(async (platform) => {
    try {
      // Check cancellation before retailer starts
      await cancellationManager.checkCancelled(jobId);

      console.log(`[ScraperWorker] Running scraper: ${platform.name} for "${query}"`);
      const results = await platform.scraper.search(query, jobId) || [];

      // Check cancellation after retailer completes
      await cancellationManager.checkCancelled(jobId);

      console.log(`[ScraperWorker] Scraper ${platform.name} completed. Found ${results.length} items.`);
      
      totalFetched += results.length;
      console.log("productsFetched", results.length);

      const itemsToUpsert = [];
      results.forEach((item) => {
        if (item.title && item.price && item.link) {
          const productForScoring = {
            title: item.title,
            price: item.price,
            image: item.image,
            link: item.link,
            brand: item.brand || 'Unknown'
          };
          const qScore = scoreProduct(productForScoring);

          if (qScore < 50) {
            console.warn(`[CatalogQuality] LOW QUALITY WARNING: Retailer=${platform.name} Title="${item.title.substring(0, 50)}..." Price=${item.price} ImagePresent=${!!item.image} Score=${qScore}`);
          }

          itemsToUpsert.push({
            title: item.title,
            price: item.price,
            image: item.image || null,
            imageCandidates: item.imageCandidates || [],
            qualityScore: qScore,
            url: item.link,
            source: platform.name,
            queryKey: queryKey,
            scrapeJobId: scrapeJobId,
            scrapedAt: new Date(),
            uniqueHash: generateSoftHash(item.title, item.price, platform.name)
          });
        }
      });

      if (itemsToUpsert.length > 0) {
        // Check cancellation before DB writes
        await cancellationManager.checkCancelled(jobId);

        const operations = itemsToUpsert.map((item) => ({
          updateOne: {
            filter: { uniqueHash: item.uniqueHash, scrapeJobId: item.scrapeJobId },
            update: { $set: item },
            upsert: true
          }
        }));

        const writeResult = await ScrapedProduct.bulkWrite(operations);
        const inserted = (writeResult.upsertedCount || 0) + (writeResult.modifiedCount || 0) + (writeResult.insertedCount || 0);
        totalInserted += inserted;
        console.log("productsInserted", inserted);
        console.log("when products are inserted");
        
        // Check cancellation before emitting update notification
        await cancellationManager.checkCancelled(jobId);

        // Stream retailer results directly via SSE to preserve incremental UX
        const formattedRetailerRaw = itemsToUpsert.map(doc => ({
          title: doc.title,
          price: doc.price,
          image: doc.image || null,
          link: doc.url,
          platform: PLATFORM_NAME_MAP[doc.source.toLowerCase()] || doc.source,
          brand: 'Unknown',
          category: 'General'
        }));
        const retailerGroupedCards = matchingService.mergeProducts(formattedRetailerRaw, query);
        const pubSubPayload = {
          type: 'partial-results',
          products: retailerGroupedCards,
          final: false
        };
        await pubSub.publish(`search:update:${queryKey}`, pubSubPayload);
      }
    } catch (err) {
      if (err.message === 'JOB_CANCELLED') {
        cancelled = true;
        console.log(`[ScraperWorker] Job cancelled during ${platform.name} scraping for "${query}".`);
        return; // Stop this platform's work silently
      }
      console.error(`[ScraperWorker] Scraper ${platform.name} failed:`, err.message);
    }
  });

  // Run all scrapers in parallel
  await Promise.all(scrapePromises);

  if (cancelled) {
    console.log(`[ScraperWorker] Scraping aborted (job cancelled) for query: "${query}"`);
    throw new Error('JOB_CANCELLED');
  }

  console.log("scrapeFinished");
  console.log(`[GENERATION COMPLETE] queryKey="${queryKey}" totalFetched=${totalFetched} totalInserted=${totalInserted}`);
  console.log(`[ScraperWorker] Scraping finished. Total fetched: ${totalFetched}, Total inserted: ${totalInserted}`);

  await ScrapeJob.findByIdAndUpdate(jobId, {
    $set: { needsAggregation: true, updatedAt: new Date() }
  });
}

async function startWorker() {
  if (!SCRAPING_ENABLED) {
    console.log('[ScraperWorker] Scraping disabled.');
    return;
  }
  console.log("Worker started");
  console.log('[ScraperWorker] Worker loop started...');
  
  try {
    // Recovery logic on worker startup: reset jobs stuck in 'scraping' for >2 minutes back to 'pending'
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recovered = await ScrapeJob.updateMany(
      { status: 'scraping', updatedAt: { $lt: twoMinutesAgo } },
      { $set: { status: 'pending', updatedAt: new Date() } }
    );
    if (recovered.modifiedCount > 0) {
      console.log(`[ScraperWorker] Cleaned up ${recovered.modifiedCount} stuck scraping jobs back to pending.`);
    }
  } catch (err) {
    console.error('[ScraperWorker] Startup recovery failed:', err.message);
  }
  
  while (true) {
    try {
      // Find a pending job OR a stuck scraping job and lock it
      const job = await ScrapeJob.findOneAndUpdate(
        {
          $or: [
            { status: 'pending' },
            { 
              status: 'scraping', 
              updatedAt: { $lt: new Date(Date.now() - 60 * 1000) } // stuck > 1 minute
            }
          ]
        },
        { 
          $set: { status: 'scraping', updatedAt: new Date() },
          $inc: { attempts: 1 }
        },
        { sort: { createdAt: 1 }, new: true }
      );

      if (job) {
        console.log("Job picked");
        console.log(`[ScraperWorker] Job picked: "${job.query}"`);
        
        try {
          console.log("Scraping started");
          console.log(`[ScraperWorker] Scraping started for: "${job.query}"`);
          
          await runScraping(job);
          
          // Double check DB status to see if it was cancelled in the meantime
          const checkJob = await ScrapeJob.findById(job._id);
          if (checkJob && checkJob.status === 'cancelled') {
            console.log(`[ScraperWorker] Job ${job._id} was cancelled during scraping. Skipping status update.`);
            continue;
          }

          console.log("Scraping completed");
          console.log(`[ScraperWorker] Scraping completed for query: "${job.query}"`);
          
          // Move status to 'scraped'
          job.status = 'scraped';
          job.updatedAt = new Date();
          await job.save();
        } catch (err) {
          console.error(`[ScraperWorker] Scrape failed for job ${job._id}:`, err);
          if (err.message === 'JOB_CANCELLED') {
            job.status = 'cancelled';
          } else {
            job.status = 'failed';
          }
          job.error = err.message;
          job.updatedAt = new Date();
          await job.save();
        }
      } else {
        // No jobs to run, sleep for 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.error('[ScraperWorker] Error in polling loop:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Connect to MongoDB and run
if (require.main === module) {
  if (!SCRAPING_ENABLED) {
    console.log('[ScraperWorker] Scraping disabled. Exiting.');
    process.exit(0);
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not specified in environment.');
    process.exit(1);
  }
  
  console.log('[ScraperWorker] Connecting to MongoDB...');
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

module.exports = { runScraping };
