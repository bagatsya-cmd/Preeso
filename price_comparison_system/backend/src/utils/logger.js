/**
 * Structured Logger for Preeso
 * Replaces console.log with timestamped, categorized, JSON-structured output.
 * Zero external dependencies.
 */

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

// ── Metrics store (in-memory, read via /api/system/status) ───────────────────
const metrics = {
  scraperDurations:  {},   // platform → [ms, ms, ...]  (last 20)
  cacheHits:         0,
  cacheMisses:       0,
  sseStreams:        0,    // active count
  sseCompleted:      0,
  imageFailures:     0,
  avgProductsPerPlatform: {},
};

function emit(level, category, msg, meta = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    category,
    msg,
    ...meta,
  };
  const line = `[${entry.ts}] [${level}] [${category}] ${msg}` +
    (Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '');

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

const logger = {
  // ── Generic levels ──────────────────────────────────────────────────────────
  debug: (cat, msg, meta) => emit('DEBUG', cat, msg, meta),
  info:  (cat, msg, meta) => emit('INFO',  cat, msg, meta),
  warn:  (cat, msg, meta) => emit('WARN',  cat, msg, meta),
  error: (cat, msg, meta) => emit('ERROR', cat, msg, meta),

  // ── Domain-specific helpers ─────────────────────────────────────────────────
  scraper: {
    start:   (platform, url) => emit('INFO', platform, `Starting scrape → ${url}`),
    success: (platform, count, ms) => {
      emit('INFO', platform, `✅ ${count} products in ${ms}ms`);
      if (!metrics.scraperDurations[platform]) metrics.scraperDurations[platform] = [];
      metrics.scraperDurations[platform].push(ms);
      if (metrics.scraperDurations[platform].length > 20)
        metrics.scraperDurations[platform].shift();
      // Running average products
      if (!metrics.avgProductsPerPlatform[platform]) metrics.avgProductsPerPlatform[platform] = [];
      metrics.avgProductsPerPlatform[platform].push(count);
      if (metrics.avgProductsPerPlatform[platform].length > 20)
        metrics.avgProductsPerPlatform[platform].shift();
    },
    fail:    (platform, err, ms) => emit('WARN', platform, `❌ Failed in ${ms}ms: ${err}`),
    timeout: (platform, ms)      => emit('WARN', platform, `⏱  Timeout after ${ms}ms`),
  },

  cache: {
    hit:  (key) => { metrics.cacheHits++;   emit('DEBUG', 'Cache', `HIT  ${key}`); },
    miss: (key) => { metrics.cacheMisses++; emit('DEBUG', 'Cache', `MISS ${key}`); },
    set:  (key, ttl) => emit('DEBUG', 'Cache', `SET  ${key} ttl=${ttl}s`),
  },

  sse: {
    open:     (query) => { metrics.sseStreams++;     emit('INFO', 'SSE', `Open  "${query}"`); },
    complete: (query, ms, total) => {
      metrics.sseStreams = Math.max(0, metrics.sseStreams - 1);
      metrics.sseCompleted++;
      emit('INFO', 'SSE', `Done  "${query}" → ${total} products in ${ms}ms`);
    },
    error:    (query, err) => emit('ERROR', 'SSE', `Error "${query}": ${err}`),
  },

  image: {
    fail: (url) => { metrics.imageFailures++; emit('DEBUG', 'Image', `Failed: ${url}`); },
  },

  // ── Metrics snapshot ────────────────────────────────────────────────────────
  getMetrics() {
    const avgDurations = {};
    for (const [p, durations] of Object.entries(metrics.scraperDurations)) {
      avgDurations[p] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
    const avgProducts = {};
    for (const [p, counts] of Object.entries(metrics.avgProductsPerPlatform)) {
      avgProducts[p] = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
    }
    const total = metrics.cacheHits + metrics.cacheMisses;
    return {
      cacheHitRate:          total > 0 ? `${Math.round((metrics.cacheHits / total) * 100)}%` : 'N/A',
      cacheHits:             metrics.cacheHits,
      cacheMisses:           metrics.cacheMisses,
      activeSSEStreams:       metrics.sseStreams,
      completedSSEStreams:    metrics.sseCompleted,
      imageFailures:         metrics.imageFailures,
      avgScraperDurations:   avgDurations,
      avgProductsPerPlatform: avgProducts,
    };
  },
};

module.exports = logger;
