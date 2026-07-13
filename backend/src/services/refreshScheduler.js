/**
 * Background Refresh Scheduler
 * Keeps hot queries warm in the searchCache by re-scraping every 30 minutes.
 * Uses the existing scraper pipeline — no new HTTP clients needed.
 */

const logger      = require('../utils/logger');
const searchCache = require('../utils/searchCache');

// ── Queries to keep warm, in priority order ────────────────────────────────────
const HOT_QUERIES = [
  'iPhone 15',
  'Samsung S25',
  'OnePlus 12',
  'MacBook Air',
  'AirPods Pro',
  'earbuds',
  'gaming laptop',
  'Nike sneakers',
];

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;  // 30 minutes
const STAGGER_MS          =  2 * 60 * 1000;  // 2 minutes between each query

// Track search frequency for dynamic warm-up
const searchFrequency = new Map();   // query → count

class RefreshScheduler {
  constructor() {
    this._timer  = null;
    this._active = false;
  }

  // ── Record a user search (called by streamController) ─────────────────────
  trackSearch(query) {
    const key = query.toLowerCase().trim();
    searchFrequency.set(key, (searchFrequency.get(key) || 0) + 1);
  }

  // ── Get the most-searched queries (top N) ──────────────────────────────────
  getTopQueries(n = 10) {
    return [...searchFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([q, count]) => ({ query: q, count }));
  }

  // ── Refresh a single query in the background ───────────────────────────────
  async _refreshQuery(query) {
    try {
      // Only refresh if cache is stale or missing
      if (!searchCache.isMergedStale(query)) {
        logger.debug('Scheduler', `Skip "${query}" — cache still fresh`);
        return;
      }

      logger.info('Scheduler', `Background refresh: "${query}"`);

      // Lazy-require to avoid circular deps
      const { runScrape } = require('./scrapeRunner');
      const products = await runScrape(query);

      if (products?.length > 0) {
        searchCache.setMerged(query, products);
        logger.info('Scheduler', `Refreshed "${query}" → ${products.length} products`);
      }
    } catch (err) {
      logger.warn('Scheduler', `Refresh failed for "${query}": ${err.message}`);
    }
  }

  // ── Start background refresh loop ──────────────────────────────────────────
  start() {
    if (this._active) return;
    this._active = true;
    logger.info('Scheduler', `Started — ${HOT_QUERIES.length} hot queries, interval=${REFRESH_INTERVAL_MS / 60000}min`);

    const runCycle = async () => {
      const streamController = require('../controllers/streamController');
      if (streamController.getActiveSearches && streamController.getActiveSearches() > 0) {
        logger.info('Scheduler', 'Skipped due to active searches');
        return;
      }

      // Merge static hot queries with dynamic top-searched
      const dynamic = this.getTopQueries(5).map(q => q.query);
      const allQueries = [...new Set([...HOT_QUERIES, ...dynamic])];

      for (let i = 0; i < allQueries.length; i++) {
        // Stagger to avoid hammering all platforms at once
        setTimeout(() => this._refreshQuery(allQueries[i]), i * STAGGER_MS);
      }
    };

    // First run after 5 minutes (let server warm up)
    setTimeout(runCycle, 5 * 60 * 1000);
    this._timer = setInterval(runCycle, REFRESH_INTERVAL_MS);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._active = false;
    logger.info('Scheduler', 'Stopped');
  }

  getStats() {
    return {
      active:       this._active,
      hotQueries:   HOT_QUERIES,
      topSearched:  this.getTopQueries(10),
      totalTracked: searchFrequency.size,
    };
  }
}

module.exports = new RefreshScheduler();
