/**
 * Scrape Runner — thin wrapper used by the refresh scheduler.
 * Runs all 4 scrapers in parallel and returns merged results.
 * Isolated here to avoid circular deps between refreshScheduler ↔ streamController.
 */

const matchingService = require('./matchingService');
const amazonScraper   = require('../scrapers/amazon');
const flipkartScraper = require('../scrapers/flipkart');
const myntraScraper   = require('../scrapers/myntra');
const relianceScraper = require('../scrapers/reliance');
const ajioScraper     = require('../scrapers/ajio');
const nykaaScraper    = require('../scrapers/nykaa');
const scraperHealth   = require('../utils/scraperHealth');
const logger          = require('../utils/logger');

const ALL_PLATFORMS = [
  { name: 'Flipkart',         scraper: flipkartScraper,  timeoutMs: 5000 },
  { name: 'Amazon',           scraper: amazonScraper,    timeoutMs: 6000 },
  { name: 'Reliance Digital', scraper: relianceScraper,  timeoutMs: 6000 },
  { name: 'AJIO',             scraper: ajioScraper,      timeoutMs: 6000 },
  { name: 'Nykaa',            scraper: nykaaScraper,     timeoutMs: 6000 },
  { name: 'Myntra',           scraper: myntraScraper,    timeoutMs: 4000 },
];

const PLATFORMS = process.env.ENABLE_AMAZON === 'true'
  ? ALL_PLATFORMS
  : ALL_PLATFORMS.filter(p => p.name !== 'Amazon');

async function runScrape(query) {
  const allRaw = [];

  await Promise.all(PLATFORMS.map(async ({ name, scraper, timeoutMs }) => {
    if (!scraperHealth.isEnabled(name)) {
      logger.warn('ScrapeRunner', `${name} is currently disabled (health cooldown)`);
      return;
    }

    const start = Date.now();
    try {
      const raw = await Promise.race([
        scraper.search(query),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);
      const ms = Date.now() - start;
      scraperHealth.recordSuccess(name, ms);
      logger.scraper.success(name, raw?.length ?? 0, ms);
      if (raw?.length) allRaw.push(...raw);
    } catch (err) {
      const ms = Date.now() - start;
      scraperHealth.recordFailure(name, ms);
      logger.scraper.fail(name, err.message, ms);
    }
  }));

  return allRaw.length > 0 ? matchingService.mergeProducts(allRaw, query) : [];
}

module.exports = { runScrape };
