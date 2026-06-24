const ProductResult = require('../models/productResult');
const ScrapeJob = require('../models/scrapeJob');
const pubSub = require('../utils/pubSub');
const { normalizeQuery } = require('../utils/queryNormalizer');
const logger = require('../utils/logger');

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

      console.log(`[PIPELINE-TRACE] Stage 6a (SSE Send): Sending ${data.products.length} products to frontend via PubSub path (final=true)`);
      // Stream refreshed products to the client
      send({
        type: 'partial-results',
        final: true,
        products: data.products
      });

      // Signal completion
      const totalMs = Date.now() - searchStart;
      send({ type: 'complete', final: true, totalUnique: data.products.length, totalMs });
      send({ type: 'completed', totalUnique: data.products.length, totalMs });

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

          // Deliver results if they are newer than what we initially served from cache
          if (resDoc && resDoc.products && resDoc.products.length > 0 &&
              (!cachedResultTimestamp || resultTimestamp > cachedResultTimestamp)) {

            console.log(`[SSE REFRESH DELIVERED] queryKey="${queryKey}" resultCount=${resDoc.products.length}`);
            console.log(`[PIPELINE-TRACE] Stage 5b (Poll→SSE): Read ${resDoc.products.length} products from ProductResult for queryKey="${queryKey}"`);
            console.log(`[PUBSUB DELIVERY] queryKey="${queryKey}" source=polling`);

            refreshDelivered = true;

            console.log(`[PIPELINE-TRACE] Stage 6b (SSE Send): Sending ${resDoc.products.length} products to frontend via polling path (final=true)`);
            send({
              type: 'partial-results',
              final: true,
              products: resDoc.products
            });
          }

          // Close the stream — job is completed regardless of whether we delivered new results
          const totalMs = Date.now() - searchStart;
          send({
            type: 'complete',
            final: true,
            totalUnique: resDoc?.products?.length || 0,
            totalMs
          });
          send({
            type: 'completed',
            totalUnique: resDoc?.products?.length || 0,
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
    // 1. Fetch cached results and serve immediately (but NEVER close the stream here)
    const cachedResult = await ProductResult.findOne({ queryKey }).lean();
    console.log(`[DB RESULT] queryKey="${queryKey}" productResultsCount=${cachedResult?.products?.length || 0}`);

    if (cachedResult && cachedResult.products && cachedResult.products.length > 0) {
      cachedResultTimestamp = new Date(cachedResult.updatedAt).getTime();
      const age = Date.now() - cachedResultTimestamp;

      console.log(`[CACHE RESULT] queryKey="${queryKey}" resultCount=${cachedResult.products.length} createdAt="${new Date(cachedResult.updatedAt).toISOString()}"`);
      console.log(`[SSE CACHE SERVED] queryKey="${queryKey}" resultCount=${cachedResult.products.length}`);
      console.log(`[PIPELINE-TRACE] Stage 5c (Cache→SSE): Serving ${cachedResult.products.length} cached products for queryKey="${queryKey}" (age: ${Math.round(age / 1000)}s)`);
      console.log("cacheHitKey", queryKey);
      console.log(`[SSE] Cache HIT for "${queryKey}" (Age: ${Math.round(age / 60000)}m)`);

      // Send cached data immediately as non-final results
      console.log(`[PIPELINE-TRACE] Stage 6c (SSE Send): Sending ${cachedResult.products.length} CACHED products to frontend (final=false)`);
      send({
        type: 'partial-results',
        final: false,
        products: cachedResult.products
      });

      // NOTE: Stream stays open. We proceed to trigger a background refresh below.
    } else {
      console.log(`[SSE] Cache MISS for "${queryKey}"`);
      send('scraper-status', { store: 'System', status: 'Searching platforms in background...' });
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
