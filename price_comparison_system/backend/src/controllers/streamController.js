const ProductResult = require('../models/productResult');
const ScrapeJob = require('../models/scrapeJob');
const pubSub = require('../utils/pubSub');
const { normalizeQuery } = require('../utils/queryNormalizer');
const logger = require('../utils/logger');

// ── Stop-words excluded from keyword matching ──────────────────────────────────
const CATALOG_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'on', 'at',
  'new', 'buy', 'best', 'top', 'latest', 'good', 'great', 'online',
]);

/**
 * searchCatalog — keyword fallback before live scraping.
 *
 * Searches ALL existing ProductResult documents for embedded products whose
 * baseName or brand contains at least one keyword from the query.
 * Results are ranked by keyword overlap count and capped at 50.
 *
 * Does NOT modify any data. Read-only query on the productresults collection.
 * Only called on an exact-query cache miss.
 *
 * @param {string} query  Normalized search query string.
 * @returns {Promise<Array>} Array of matched product cards (same shape as ProductResult.products items).
 */
async function searchCatalog(query) {
  try {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1 && !CATALOG_STOP_WORDS.has(w));

    if (keywords.length === 0) return [];

    // Build one regex per keyword. Each regex is applied to baseName and brand.
    const regexes = keywords.map(k => new RegExp(k, 'i'));

    // Fetch all ProductResult documents whose embedded products array contains at
    // least one product matching any keyword in baseName or brand.
    // $or across fields; MongoDB still scans the collection but the array is small
    // (286 docs at production time) so this is consistently < 5 ms.
    const matchingDocs = await ProductResult.find({
      $or: [
        { 'products.baseName': { $in: regexes } },
        { 'products.brand':    { $in: regexes } },
      ],
    }, { products: 1 }).lean();

    if (!matchingDocs.length) return [];

    // Flatten all embedded product cards from matched documents.
    const allProducts = matchingDocs.flatMap(doc => doc.products || []);

    // Score each product by how many keywords appear in baseName + brand.
    const scored = allProducts
      .map(p => {
        const haystack = `${p.baseName || ''} ${p.brand || ''}`.toLowerCase();
        const score = keywords.filter(k => haystack.includes(k)).length;
        return { product: p, score };
      })
      .filter(({ score }) => score > 0);

    // Sort highest-scoring first, deduplicate by baseName, cap at 50.
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const results = [];
    for (const { product } of scored) {
      const key = (product.baseName || '').toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(product);
      }
      if (results.length >= 50) break;
    }

    return results;
  } catch (err) {
    // Never block the main SSE flow on a catalog search error.
    console.error('[SSE] Catalog search error (non-fatal):', err.message);
    return [];
  }
}

function sanitizeProducts(products) {
  if (!products) return [];
  if (process.env.ENABLE_AMAZON === 'true') {
    return products;
  }
  return products
    .map(product => {
      const filteredStores = (product.stores || []).filter(s => s.storeName !== 'Amazon');
      if (filteredStores.length === 0) return null;
      return {
        ...product,
        stores: filteredStores,
        lowestPrice: Math.min(...filteredStores.map(s => s.price))
      };
    })
    .filter(Boolean);
}

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

let activeSearches = 0;
exports.getActiveSearches = () => activeSearches;

const SSE_MAX_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes max SSE open time

exports.streamSearch = async (req, res) => {
  console.log('[SSE RECEIVED]', req.query.q, req.ip, req.headers.host);
  activeSearches++;
  const { q: query } = req.query;
  if (!query?.trim()) {
    activeSearches--;
    return res.status(400).json({ error: 'Query is required' });
  }

  const normalizedQuery = normalizeQuery(query);
  const queryKey = normalizedQuery.replace(/\s+/g, '_');
  const searchStart = Date.now();
  const alive = { ok: true };
  const send = makeSend(res, alive);

  console.log("normalizedQuery", normalizedQuery);
  console.log("queryKey", queryKey);
  console.log(`[SSE] Search request: "${normalizedQuery}" | queryKey: "${queryKey}"`);

  // SSE headers
  res.writeHead(200, {
    'Content-Type':            'text/event-stream',
    'Cache-Control':           'no-cache, no-store',
    'Connection':              'keep-alive',
    'X-Accel-Buffering':       'no',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  });

  // Keep-alive heartbeat (every 12 seconds)
  const heartbeat = setInterval(() => {
    if (alive.ok) res.write('event: heartbeat\ndata: ping\n\n');
  }, 12000);

  // Track the timestamp of initially served cached results for change detection
  let cachedResultTimestamp = null;
  let refreshDelivered = false;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    clearInterval(checkInterval);
    clearTimeout(maxTimeout);
    pubSub.unsubscribe(`search:update:${queryKey}`, updateCallback);
    if (alive.ok) {
      res.end();
      alive.ok = false;
    }
    activeSearches--;
    console.log(`[SSE] Closed stream for queryKey: "${queryKey}"`);
  };

  req.on('close', () => {
    cleanup();
  });

  // ── Max timeout: prevents indefinite SSE connections ──────────────────────
  const maxTimeout = setTimeout(() => {
    if (alive.ok) {
      console.log(`[SSE] Max timeout (${SSE_MAX_TIMEOUT_MS / 1000}s) reached for queryKey: "${queryKey}". Closing stream.`);
      const totalMs = Date.now() - searchStart;
      send({ type: 'complete', final: true, totalUnique: 0, totalMs });
      send({ type: 'completed', totalUnique: 0, totalMs });
      cleanup();
    }
  }, SSE_MAX_TIMEOUT_MS);

  // ── Pub/Sub update callback (works when Redis is available) ───────────────
  const updateCallback = (message) => {
    if (!alive.ok || refreshDelivered) return;
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;

      console.log(`[SSE REFRESH DELIVERED] queryKey="${queryKey}" resultCount=${data.products?.length || 0}`);
      console.log(`[PIPELINE-TRACE] Stage 5a (PubSub→SSE): Received ${data.products?.length || 0} products from PubSub for queryKey="${queryKey}"`);      
      console.log(`[PUBSUB DELIVERY] queryKey="${queryKey}" source=redis`);

      refreshDelivered = true;

      const sanitized = sanitizeProducts(data.products || []);
      console.log(`[PIPELINE-TRACE] Stage 6a (SSE Send): Sending ${sanitized.length} products to frontend via PubSub path (final=true)`);
      // Stream refreshed products to the client
      send({
        type: 'partial-results',
        final: true,
        products: sanitized
      });

      // Signal completion
      const totalMs = Date.now() - searchStart;
      send({ type: 'complete', final: true, totalUnique: sanitized.length, totalMs });
      send({ type: 'completed', totalUnique: sanitized.length, totalMs });

      cleanup();
    } catch (err) {
      console.error('[SSE] Error handling PubSub update:', err.message);
    }
  };

  // ── Polling fallback: reliable cross-process update detection ─────────────
  // Workers run in forked child processes. Without Redis, the local EventEmitter
  // cannot deliver PubSub events across process boundaries. This polling interval
  // checks for job completion AND detects ProductResult.updatedAt changes.
  const checkInterval = setInterval(async () => {
    if (!alive.ok || refreshDelivered) {
      cleanup();
      return;
    }
    try {
      // Find the newest job for this queryKey
      const job = await ScrapeJob.findOne({ queryKey }).sort({ createdAt: -1 });
      if (job) {
        if (job.status === 'completed') {
          const resDoc = await ProductResult.findOne({ queryKey }).lean();
          const resultTimestamp = resDoc ? new Date(resDoc.updatedAt).getTime() : 0;

          const sanitized = resDoc && resDoc.products ? sanitizeProducts(resDoc.products) : [];
          // Deliver results if they are newer than what we initially served from cache
          if (resDoc && resDoc.products && resDoc.products.length > 0 &&
              (!cachedResultTimestamp || resultTimestamp > cachedResultTimestamp)) {

            console.log(`[SSE REFRESH DELIVERED] queryKey="${queryKey}" resultCount=${sanitized.length}`);
            console.log(`[PIPELINE-TRACE] Stage 5b (Poll→SSE): Read ${sanitized.length} products from ProductResult for queryKey="${queryKey}"`);
            console.log(`[PUBSUB DELIVERY] queryKey="${queryKey}" source=polling`);

            refreshDelivered = true;

            console.log(`[PIPELINE-TRACE] Stage 6b (SSE Send): Sending ${sanitized.length} products to frontend via polling path (final=true)`);
            send({
              type: 'partial-results',
              final: true,
              products: sanitized
            });
          }

          // Close the stream — job is completed regardless of whether we delivered new results
          const totalMs = Date.now() - searchStart;
          send({
            type: 'complete',
            final: true,
            totalUnique: sanitized.length,
            totalMs
          });
          send({
            type: 'completed',
            totalUnique: sanitized.length,
            totalMs
          });
          cleanup();

        } else if (job.status === 'failed') {
          send('error', { message: `Search failed: ${job.error || 'Unknown error'}` });
          cleanup();
        }
        // For 'pending', 'scraping', 'scraped', 'aggregating' — keep polling
      }
      // If no job found at all, keep polling (job may not have been created yet)
    } catch (err) {
      console.error('[SSE] Error polling job status:', err.message);
    }
  }, 2000);

  // ── Main request flow ─────────────────────────────────────────────────────
  try {
    // Step 1. Exact query cache — fastest path, unchanged behaviour.
    const cachedResult = await ProductResult.findOne({ queryKey }).lean();
    console.log(`[DB RESULT] queryKey="${queryKey}" productResultsCount=${cachedResult?.products?.length || 0}`);

    const sanitizedCached = cachedResult && cachedResult.products ? sanitizeProducts(cachedResult.products) : [];
    if (cachedResult && cachedResult.products && cachedResult.products.length > 0) {
      cachedResultTimestamp = new Date(cachedResult.updatedAt).getTime();
      const age = Date.now() - cachedResultTimestamp;

      console.log(`[CACHE RESULT] queryKey="${queryKey}" resultCount=${sanitizedCached.length} createdAt="${new Date(cachedResult.updatedAt).toISOString()}"`);
      console.log(`[SSE CACHE SERVED] queryKey="${queryKey}" resultCount=${sanitizedCached.length}`);
      console.log(`[PIPELINE-TRACE] Stage 5c (Cache→SSE): Serving ${sanitizedCached.length} cached products for queryKey="${queryKey}" (age: ${Math.round(age / 1000)}s)`);
      console.log("cacheHitKey", queryKey);
      console.log(`[SSE] Cache HIT for "${queryKey}" (Age: ${Math.round(age / 60000)}m)`);

      // Send cached data immediately as non-final results
      console.log(`[PIPELINE-TRACE] Stage 6c (SSE Send): Sending ${sanitizedCached.length} CACHED products to frontend (final=false)`);
      send({
        type: 'partial-results',
        final: false,
        products: sanitizedCached
      });

      // NOTE: Stream stays open. We proceed to trigger a background refresh below.

    } else {
      // Step 2. Catalog fallback — search ALL existing ProductResult documents for
      // products matching any keyword in the query. Only runs on a cache miss.
      // Read-only. Does not affect scraping, job creation, or any other flow.
      const catalogProducts = await searchCatalog(normalizedQuery);
      const sanitizedCatalog = sanitizeProducts(catalogProducts);

      if (sanitizedCatalog.length > 0) {
        cachedResultTimestamp = Date.now();
        console.log(`[SSE] Catalog HIT for "${normalizedQuery}" — ${sanitizedCatalog.length} products from historical data`);
        console.log(`[PIPELINE-TRACE] Stage 5d (Catalog→SSE): Serving ${sanitizedCatalog.length} catalog products for query="${normalizedQuery}" (final=false)`);
        send({
          type:     'partial-results',
          cached:   true,
          source:   'catalog',
          final:    false,
          products: sanitizedCatalog,
        });
        // Stream stays open — scraping continues in background below.
      } else {
        console.log(`[SSE] Cache MISS and Catalog MISS for "${queryKey}"`);
        send('scraper-status', { store: 'System', status: 'Searching platforms in background...' });
      }
    }

    // 2. Always trigger a background scrape/refresh job (with deduplication)

    // Recovery: reset any job for this queryKey stuck in 'scraping' or 'aggregating' for >2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await ScrapeJob.updateMany(
      {
        queryKey,
        status: { $in: ['scraping', 'aggregating'] },
        updatedAt: { $lt: twoMinutesAgo }
      },
      {
        $set: { status: 'pending', updatedAt: new Date() }
      }
    );

    // Dedup: check for an active in-progress job OR a recently completed job (< 5 min)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeJob = await ScrapeJob.findOne({
      queryKey,
      $or: [
        {
          status: { $in: ['pending', 'scraping', 'scraped', 'aggregating'] },
          updatedAt: { $gte: fifteenMinutesAgo }
        },
        {
          status: 'completed',
          updatedAt: { $gte: fiveMinutesAgo }
        }
      ]
    });

    console.log(`[JOB CHECK] queryKey="${queryKey}" jobFound=${!!activeJob} jobStatus="${activeJob ? activeJob.status : 'none'}"`);

    if (!activeJob) {
      console.log(`[REFRESH JOB CREATED] queryKey="${queryKey}"`);
      await ScrapeJob.create({
        query: normalizedQuery,
        queryKey,
        status: 'pending'
      });
    } else {
      const reason = activeJob.status === 'completed'
        ? `recently_completed (${Math.round((Date.now() - new Date(activeJob.updatedAt).getTime()) / 1000)}s ago)`
        : `active_job_exists (status: ${activeJob.status})`;
      console.log(`[REFRESH JOB SKIPPED] queryKey="${queryKey}" reason="${reason}"`);
    }

    // Subscribe to pubSub channel for updates (effective when Redis is configured)
    await pubSub.subscribe(`search:update:${queryKey}`, updateCallback);

  } catch (err) {
    console.error('[SSE] streamSearch error:', err);
    if (alive.ok) send('error', { message: 'Search stream failed.' });
    cleanup();
  }
};
