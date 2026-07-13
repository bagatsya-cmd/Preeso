const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { SCRAPING_ENABLED } = require('../config/features');

const ScrapeJob = require('../models/scrapeJob');
const ScrapedProduct = require('../models/scrapedProduct');
const { generateUniqueHash, generateSoftHash } = require('../utils/deduplicator');

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
  
  console.log("scrapeStarted");
  console.log("Active retailers:", APPROVED_PLATFORMS.length);
  console.log(`[ScraperWorker] Starting parallel scrape for query: "${query}" (queryKey: "${queryKey}")`);
  
  let totalFetched = 0;
  let totalInserted = 0;
  let cancelled = false;

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
          if (process.env.DISABLE_IMAGE_VALIDATION === 'true' && item.image) {
            console.log(`[IMAGE_SAVED]\nstage=scraped_product_db_write\nretailer=${platform.name}\nproduct=${item.title}\nimage=${item.image}`);
          }
          itemsToUpsert.push({
            title: item.title,
            price: item.price,
            image: item.image || null,
            url: item.link,
            source: platform.name,
            queryKey: queryKey,
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
            filter: { uniqueHash: item.uniqueHash },
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

        // Notify aggregator that there is new data to aggregate
        await ScrapeJob.findByIdAndUpdate(job._id, {
          $set: { needsAggregation: true, updatedAt: new Date() }
        });
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
  console.log(`[ScraperWorker] Scraping finished. Total fetched: ${totalFetched}, Total inserted: ${totalInserted}`);
}

async function startWorker() {
  if (!SCRAPING_ENABLED) {
    console.log('[ScraperWorker] Scraping disabled. Worker will not start.');
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
