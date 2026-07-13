// In production: const { Worker } = require('bullmq');
// const { Cluster } = require('puppeteer-cluster');
const matchingService = require('../services/matchingService');

// Require the individual scrapers (to be built)
// const AmazonScraper = require('../scrapers/amazon');
// const FlipkartScraper = require('../scrapers/flipkart');

/**
 * Worker Logic for processing scraping jobs
 */
const processSearchJob = async (job) => {
  const { query, jobId } = job.data;
  console.log(`[SearchWorker] Processing job ${jobId} for query: "${query}"`);

  // In production, we use puppeteer-cluster here:
  // const cluster = await Cluster.launch({
  //   concurrency: Cluster.CONCURRENCY_CONTEXT,
  //   maxConcurrency: 3,
  // });

  const rawResults = [];

  // Define tasks for cluster
  const platforms = ['Amazon', 'Flipkart', 'Myntra'];
  
  // Simulate concurrent scraping with Promise.allSettled to ensure 
  // failure of one doesn't crash the others
  console.log(`[SearchWorker] Dispatching scrapers for: ${platforms.join(', ')}`);
  
  const results = await Promise.allSettled(
    platforms.map(async (platform) => {
      console.log(`[${platform}] Search started for "${query}"`);
      
      // Simulate scraper delay and anti-bot retry logic
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      
      // Simulate 403 Forbidden randomly for architecture demonstration
      if (platform === 'Flipkart' && Math.random() > 0.8) {
        throw new Error('403 Forbidden (Bot Detected)');
      }

      // Mock extracted data
      return [
        {
          platform,
          title: `Apple iPhone 15 128GB - ${platform} Edition`,
          price: 70000 + Math.floor(Math.random() * 5000),
          link: `https://${platform.toLowerCase()}.com/iphone15`,
          image: 'https://via.placeholder.com/150'
        }
      ];
    })
  );

  results.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      console.log(`[${platforms[idx]}] Extracted ${res.value.length} products`);
      rawResults.push(...res.value);
    } else {
      console.error(`[${platforms[idx]}] Scraper failed: ${res.reason.message}`);
    }
  });

  // Normalize and merge the results using fuzzy matching
  console.log(`[SearchWorker] Normalizing ${rawResults.length} total raw products...`);
  const mergedProducts = matchingService.mergeProducts(rawResults);
  
  console.log(`[SearchWorker] Merging complete. Yielded ${mergedProducts.length} unique products.`);
  
  // Emit event via SSE or save to DB here
  // Product.insertMany(mergedProducts)
  
  return mergedProducts;
};

// BullMQ Worker setup
// const worker = new Worker('SearchScrapingQueue', processSearchJob, { connection });
// worker.on('completed', job => console.log(`${job.id} has completed!`));
// worker.on('failed', (job, err) => console.log(`${job.id} has failed with ${err.message}`));

module.exports = {
  processSearchJob
};
