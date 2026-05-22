/**
 * Stream Controller — Phase 12
 * Phase 12: Query-intent-aware platform routing.
 *   electronics → Amazon, Flipkart, Reliance Digital only
 *   fashion     → AJIO, Myntra, Flipkart, Amazon
 *   beauty      → Nykaa, Myntra, AJIO, Amazon
 *   accessories → all platforms
 *   general     → all platforms
 * Cache layers: LRU memory → MongoDB index → live scrape
 * "Fast Mode": once 8 products found, lower-priority scrapers get shorter timeout
 */

const matchingService   = require('../services/matchingService');
const amazonScraper     = require('../scrapers/amazon');
const flipkartScraper   = require('../scrapers/flipkart');
const myntraScraper     = require('../scrapers/myntra');
const relianceScraper   = require('../scrapers/reliance');
const ajioScraper       = require('../scrapers/ajio');
const nykaaScraper      = require('../scrapers/nykaa');
const searchCache       = require('../utils/searchCache');
const scraperHealth     = require('../utils/scraperHealth');
const productIndexer    = require('../services/productIndexer');
const refreshScheduler  = require('../services/refreshScheduler');
const { classifyQuery } = require('../utils/queryClassifier');
const logger            = require('../utils/logger');

// ── Platform registry with per-category tags ─────────────────────────────────
// Phase 12: AJIO and Nykaa timeout raised to 30000ms to survive concurrent load
const ALL_PLATFORMS = [
  { name: 'Flipkart',         scraper: flipkartScraper,  timeoutMs: 4000, category: 'electronics' },
  { name: 'Amazon',           scraper: amazonScraper,    timeoutMs: 5000, category: 'electronics' },
  { name: 'Reliance Digital', scraper: relianceScraper,  timeoutMs: 4000, category: 'electronics' },
  { name: 'AJIO',             scraper: ajioScraper,      timeoutMs: 5000, category: 'fashion' },
  { name: 'Nykaa',            scraper: nykaaScraper,     timeoutMs: 5000, category: 'beauty' },
  { name: 'Myntra',           scraper: myntraScraper,    timeoutMs: 4000, category: 'fashion' },
];

/**
 * Phase 12: Re-order AND FILTER platforms based on detected query intent.
 * Electronics queries skip AJIO/Nykaa/Myntra entirely.
 * Fashion queries skip Reliance Digital.
 * Beauty queries skip Flipkart/Reliance Digital.
 * Accessories allow all platforms.
 */
function getPlatformOrder(queryIntent) {
  const byName = name => ALL_PLATFORMS.find(p => p.name === name);

  // Get the set of enabled platforms from matchingService for this intent
  const enabledSet = matchingService.getEnabledPlatforms(queryIntent);

  // Define the ordered list per intent (native platforms first)
  let order;
  if (queryIntent === 'electronics') {
    order = ['Flipkart', 'Amazon', 'Reliance Digital'];
  } else if (queryIntent === 'fashion' || queryIntent === 'beauty') {
    order = ['AJIO', 'Myntra', 'Nykaa', 'Amazon', 'Flipkart'];
  } else if (queryIntent === 'accessories') {
    order = ['Amazon', 'Flipkart', 'AJIO', 'Myntra', 'Nykaa', 'Reliance Digital'];
  } else {
    // general — all platforms
    order = ['Flipkart', 'Amazon', 'Reliance Digital', 'AJIO', 'Nykaa', 'Myntra'];
  }

  // Filter to only enabled platforms (double-check against enabledSet)
  return order
    .filter(name => enabledSet.has(name))
    .map((name, i) => ({ ...byName(name), priority: i + 1 }));
}

const FAST_MODE_THRESHOLD = 8;
const FAST_MODE_TIMEOUT   = 3000; // only for platforms NOT native to the query category

// ── SSE utilities ─────────────────────────────────────────────────────────────
function makeSend(res, alive) {
  return (typeOrObj, payload = {}) => {
    if (!alive.ok) return;
    try {
      let dataObj;
      if (typeOrObj && typeof typeOrObj === 'object') {
        dataObj = typeOrObj;
      } else {
        dataObj = { type: typeOrObj, ...payload };
      }
      res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
      if (res.flush) res.flush();
    } catch (_) {}
  };
}

// ── Canonical platform name normalizer ───────────────────────────────────────
// Maps any capitalisation variant scrapers may return to the exact display name
const PLATFORM_NAME_MAP = {
  amazon:          'Amazon',
  flipkart:        'Flipkart',
  myntra:          'Myntra',
  'reliance digital': 'Reliance Digital',
  reliancedigital: 'Reliance Digital',
  reliance:        'Reliance Digital',
  ajio:            'AJIO',
  nykaa:           'Nykaa',
  nykaafashion:    'Nykaa',
};

function normalizePlatformName(name) {
  if (!name) return name;
  return PLATFORM_NAME_MAP[name.toLowerCase().replace(/\s+/g, '')] ||
         PLATFORM_NAME_MAP[name.toLowerCase()] ||
         name; // pass through unknown platforms unchanged
}

function generateStableId(url, title, platform) {
  const input = url || `${title}-${platform}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'prod_' + Math.abs(hash).toString(36);
}

// ── Format raw scraper output into card-compatible shape ──────────────────────
function formatRaw(raw, platformName) {
  const canonical = normalizePlatformName(platformName);
  const cards = raw.map(p => {
    const stableId = generateStableId(p.link, p.title, canonical);
    return {
      _id:         stableId,
      baseName:    p.title,
      name:        p.title,
      brand:       p.brand || 'Unknown',
      category:    p.category || 'General',
      image:       p.image || null,
      imageUrl:    p.image || null,
      lowestPrice: p.price,
      rating:      p.rating || null,
      stores: [{
        storeName:     canonical,
        originalName:  p.title,
        price:         p.price,
        originalPrice: p.originalPrice || p.price,
        discount:      p.originalPrice > p.price
                         ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
                         : 0,
        url:     p.link,
        link:    p.link,
        image:   p.image || null,
        inStock: p.inStock !== false,
        rating:  p.rating || null,
      }],
    };
  });

  // Dev logging — verify AJIO and Nykaa products are reaching the stream
  if (canonical === 'AJIO') {
    console.log('[STREAM] AJIO products:', cards.length);
  }
  if (canonical === 'Nykaa') {
    console.log('[STREAM] Nykaa products:', cards.length);
  }

  return cards;
}


// ── Main handler ──────────────────────────────────────────────────────────────
let activeSearches = 0;
exports.getActiveSearches = () => activeSearches;

exports.streamSearch = async (req, res) => {
  activeSearches++;
  const { q: query, backgroundMode } = req.query;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  const normalizedQuery = query.trim();
  // Phase 12: Use rich intent detection (electronics/fashion/beauty/accessories/general)
  const queryIntent     = matchingService.detectQueryIntent(normalizedQuery);
  let PLATFORMS         = getPlatformOrder(queryIntent);

  if (backgroundMode) {
    if (queryIntent === 'electronics') {
      PLATFORMS = PLATFORMS.filter(p => ['Flipkart', 'Amazon'].includes(p.name));
    } else if (queryIntent === 'fashion' || queryIntent === 'beauty') {
      PLATFORMS = PLATFORMS.filter(p => ['AJIO', 'Nykaa'].includes(p.name));
    }
  }

  // Log which platforms were skipped for this intent
  const skippedPlatforms = ALL_PLATFORMS
    .filter(p => !PLATFORMS.find(ep => ep.name === p.name))
    .map(p => p.name);
  
  // Reset scraper health monitor at start of search to clear any stale cooldowns
  ALL_PLATFORMS.forEach(p => scraperHealth.reset(p.name));
  const searchStart     = Date.now();
  const alive           = { ok: true };
  const send            = makeSend(res, alive);

  console.log(`[STREAM] Query: "${normalizedQuery}" | Intent: ${queryIntent} | Active: [${PLATFORMS.map(p => p.name).join(', ')}]${skippedPlatforms.length ? ` | Skipped: [${skippedPlatforms.join(', ')}]` : ''}`);

  // SSE headers
  res.writeHead(200, {
    'Content-Type':            'text/event-stream',
    'Cache-Control':           'no-cache, no-store',
    'Connection':              'keep-alive',
    'X-Accel-Buffering':       'no',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  });

  req.on('close', () => { alive.ok = false; });

  // Heartbeat to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    if (alive.ok) res.write('event: heartbeat\ndata: ping\n\n');
  }, 12000);

  const done = () => {
    clearInterval(heartbeat);
    if (alive.ok) { res.end(); alive.ok = false; }
    activeSearches--;
  };

  // Track for refresh scheduler
  refreshScheduler.trackSearch(normalizedQuery);
  logger.sse.open(normalizedQuery);

  try {
    let cachedProducts = null;
    let cacheSource = null;

    // Check memory cache
    const memCached = searchCache.getMerged(normalizedQuery);
    if (memCached && memCached.length > 0) {
      logger.cache.hit(`merged:${normalizedQuery}`);
      console.log(`[CACHE HIT] "${normalizedQuery}"`);
      cachedProducts = memCached;
      cacheSource = 'cache';
    } else {
      logger.cache.miss(`merged:${normalizedQuery}`);
      console.log(`[CACHE MISS] "${normalizedQuery}"`);
      // Check MongoDB index
      const indexed = await productIndexer.getFreshResults(normalizedQuery);
      if (indexed && indexed.length > 0) {
        cachedProducts = indexed;
        cacheSource = 'index';
        searchCache.setMerged(normalizedQuery, indexed); // warm memory cache
      }
    }

    if (cachedProducts && cachedProducts.length > 0) {
      send('scraper-status', { store: 'System', status: `⚡ Loaded from ${cacheSource}` });
      send({
        type: 'partial-results',
        final: false,
        products: cachedProducts
      });
    }

    // Continue to live scraping in parallel
    send('scraper-status', { store: 'System', status: 'Searching platforms...' });

    const allRaw       = [];   // accumulates all platform results
    let   fastMode     = false;
    let   totalStreamed = 0;
    let   firstResultTime = null;

    const scraperPromises = PLATFORMS.map(async (platform) => {
      if (!alive.ok) return;

      if (!scraperHealth.isEnabled(platform.name)) {
        send('scraper-status', { store: platform.name, status: 'unavailable (cooldown)' });
        return;
      }

      send('scraper-status', { store: platform.name, status: 'searching...' });

      const platformStart = Date.now();
      let raw = [];
      try {
        raw = await platform.scraper.search(normalizedQuery) || [];
        
        if (backgroundMode && raw.length > 6) {
          raw = raw.slice(0, 6);
        }

        const ms = Date.now() - platformStart;
        scraperHealth.recordSuccess(platform.name, ms);
        logger.scraper.success(platform.name, raw.length, ms);
      } catch (err) {
        const ms = Date.now() - platformStart;
        scraperHealth.recordFailure(platform.name, ms);
        logger.scraper.fail(platform.name, err.message, ms);
        send('scraper-status', { store: platform.name, status: 'error' });
        return;
      }

      if (!alive.ok) return;
      if (!raw.length) {
        send('scraper-status', { store: platform.name, status: 'no results' });
        return;
      }

      searchCache.setPartial(normalizedQuery, platform.name, raw);
      allRaw.push(...raw);
      console.log(`[SSE] Stream chunk -> ${raw.length} products`);

      const cards = formatRaw(raw, platform.name);
      totalStreamed += raw.length;
      send('partial-results', { store: platform.name, products: cards, final: false });
      const ms = Date.now() - platformStart;
      if (!firstResultTime) {
        firstResultTime = Date.now() - searchStart;
        console.log(`[SSE] First products visible in ${firstResultTime}ms`);
      }

      send('scraper-success', {
        store: platform.name,
        resultsCount: raw.length,
        elapsed: (ms / 1000).toFixed(1),
      });
    });

    console.log('[SSE] Waiting for remaining scrapers...');

    const GLOBAL_TIMEOUT = 20000;
    await Promise.race([
      Promise.allSettled(scraperPromises),
      new Promise(resolve => setTimeout(() => {
        console.log('[SSE] Global timeout reached');
        resolve();
      }, GLOBAL_TIMEOUT))
    ]);

    console.log(`[SSE] Finalizing stream -> ${allRaw.length} total products`);

    // ── Final merge pass ──────────────────────────────────────────────────────
    if (alive.ok) {
      let merged = [];
      if (allRaw.length > 0) {
        send('matching-status', { progress: 'Grouping results...' });
        merged = matchingService.mergeProducts(allRaw, normalizedQuery);

        // Safety net: if matching filtered everything (too strict), re-run without query
        if (merged.length === 0) {
          console.warn(`[STREAM] Matching returned 0 for "${normalizedQuery}" — fallback: top-5 raw per platform`);
          const seenPlat = {};
          const fallback = allRaw.filter(p => {
            const key = p.platform || 'unknown';
            const cnt = seenPlat[key] || 0;
            if (cnt >= 5) return false;
            seenPlat[key] = cnt + 1;
            return true;
          });
          merged = matchingService.mergeProducts(fallback, '');
        }

        // Overwrite cache immediately if live scrape returns MORE products than cache
        const cachedCount = cachedProducts ? cachedProducts.length : 0;
        if (merged.length > cachedCount) {
          searchCache.setMerged(normalizedQuery, merged);
          await productIndexer.saveResults(normalizedQuery, merged);
        }
      } else {
        merged = cachedProducts || [];
      }

      const totalMs = Date.now() - searchStart;
      logger.sse.complete(normalizedQuery, totalMs, merged.length, {
        cache: cacheSource || 'miss',
        platforms: PLATFORMS.map(p => p.name).join(',')
      });
      console.log(`[SSE] Completed in ${totalMs}ms`);
      console.log(`[STREAM] Final merged: ${merged.length} products | ${totalMs}ms`);

      console.log('[SSE] Final complete');

      if (alive.ok) {
        send({
          type: 'partial-results',
          final: true,
          products: merged
        });
        send({
          type: 'complete',
          final: true,
          totalUnique: merged.length,
          totalMs: totalMs
        });
        send({
          type: 'completed',
          totalUnique: merged.length,
          totalMs: totalMs
        });
        alive.ok = false; // Prevent double completion
      }
    }

  } catch (err) {
    logger.sse.error(normalizedQuery, err.message);
    if (alive.ok) send('error', { message: 'Search failed — please try again.' });
  } finally {
    done();
  }
};
