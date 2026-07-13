/**
 * GET /api/system/status
 * Returns live operational metrics for monitoring dashboards.
 */

const router        = require('express').Router();
const os            = require('os');
const browserManager = require('../utils/browserManager');
const scraperHealth  = require('../utils/scraperHealth');
const searchCache    = require('../utils/searchCache');
const logger         = require('../utils/logger');
const scheduler      = require('../services/refreshScheduler');

const START_TIME = Date.now();

router.get('/status', (req, res) => {
  const mem  = process.memoryUsage();
  const free = os.freemem();
  const total = os.totalmem();

  res.json({
    status:       'ok',
    uptime:       `${Math.round((Date.now() - START_TIME) / 1000)}s`,
    node:         process.version,
    environment:  process.env.NODE_ENV || 'development',

    memory: {
      rssGB:       (mem.rss          / 1e9).toFixed(2) + ' GB',
      heapUsed:    (mem.heapUsed     / 1e6).toFixed(1) + ' MB',
      heapTotal:   (mem.heapTotal    / 1e6).toFixed(1) + ' MB',
      systemFree:  (free  / 1e9).toFixed(2) + ' GB',
      systemTotal: (total / 1e9).toFixed(2) + ' GB',
    },

    chromium: {
      running: !!browserManager.browser,
    },

    cache:          searchCache.stats(),
    platformHealth: scraperHealth.getAllHealth(),
    scheduler:      scheduler.getStats(),
    metrics:        logger.getMetrics(),
  });
});

// Quick health check (for Docker / load balancers)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

module.exports = router;
