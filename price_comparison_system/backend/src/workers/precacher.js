const streamController = require('../controllers/streamController');
const searchCache = require('../utils/searchCache');
const productIndexer = require('../services/productIndexer');
const logger = require('../utils/logger');

const HOT_QUERIES = [
  { q: 'iphone',    cat: 'electronics' },
  { q: 'samsung',   cat: 'electronics' },
  { q: 'laptop',    cat: 'electronics' },
  { q: 'kurti',     cat: 'fashion' },
  { q: 'heels',     cat: 'fashion' },
  { q: 'lipstick',  cat: 'beauty' },
  { q: 'sunscreen', cat: 'beauty' }
];

const PRECACHE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

class Precacher {
  constructor() {
    this.timer = null;
    this.isRunning = false;
  }

  start() {
    // TODO:
    // Re-enable smart precaching in production after:
    // - real traffic analytics
    // - hot-query tracking
    // - queue-based scraping
    // - worker isolation
    // - proxy rotation scaling
    
    // Precacher completely disabled
    console.log('[PRECACHER] Disabled for current deployment phase');
  }

  async runCycle() {
    if (streamController.getActiveSearches && streamController.getActiveSearches() > 0) {
      console.log('[PRECACHER] Skipped — active users searching');
      return;
    }
    console.log('[PRECACHER] Running precache cycle sequentially...');
    for (const item of HOT_QUERIES) {
      if (streamController.getActiveSearches && streamController.getActiveSearches() > 0) {
         console.log('[PRECACHER] Aborted midway — active users searching');
         break;
      }
      try {
        console.log(`[PRECACHER] Precaching: "${item.q}"`);
        const mockReq = { query: { q: item.q, backgroundMode: true }, on: () => {} };
        const mockRes = { 
          writeHead: () => {}, 
          write: () => {}, 
          flush: () => {}, 
          end: () => {}, 
          status: () => mockRes, 
          json: () => mockRes 
        };
        await streamController.streamSearch(mockReq, mockRes);
      } catch (err) {
        console.warn(`[PRECACHER] Failed to precache "${item.q}": ${err.message}`);
      }
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[PRECACHER] Stopped.');
  }
}

module.exports = new Precacher();
