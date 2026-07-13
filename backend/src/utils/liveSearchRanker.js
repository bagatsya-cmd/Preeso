/**
 * liveSearchRanker.js
 *
 * Ranks live-scraped search results by relevance to the user's query.
 *
 * Applied ONLY to products returned from live scraping jobs, immediately
 * before they are emitted through SSE to the frontend.
 *
 * Does NOT modify database records, cached results, search history,
 * product grouping, comparison cards, or background refresh jobs.
 */

// ── Scoring tiers ──────────────────────────────────────────────────────────────
const SCORE_EXACT_MATCH       = 1000;
const SCORE_STARTS_WITH       = 500;
const SCORE_CONTAINS_PHRASE   = 400;
const SCORE_CONTAINS_ALL      = 300;
const SCORE_CONTAINS_MOST     = 150;
const SCORE_CONTAINS_SOME     = 75;
// Related (no query words matched) = 0 — kept at the bottom by default.

/**
 * Normalize a string for comparison.
 * - lowercase
 * - trim
 * - collapse multiple spaces
 * - strip common punctuation
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')   // replace punctuation with space
    .replace(/\s+/g, ' ')       // collapse multiple spaces
    .trim();
}

/**
 * Compute a relevance score for a single product against the query.
 *
 * @param {Object} product  A product object (must have baseName or title or name).
 * @param {string} normalizedQuery  The pre-normalized search query.
 * @param {string[]} queryWords  The query split into individual words.
 * @returns {number} Relevance score (higher = more relevant).
 */
function scoreProduct(product, normalizedQuery, queryWords) {
  // Build the title string from whichever field is available.
  const rawTitle = product.baseName || product.title || product.name || '';
  const normalizedTitle = normalize(rawTitle);

  if (!normalizedTitle || !normalizedQuery) return 0;

  // 1. Exact match
  if (normalizedTitle === normalizedQuery) {
    return SCORE_EXACT_MATCH;
  }

  // 2. Title starts with query
  if (normalizedTitle.startsWith(normalizedQuery)) {
    return SCORE_STARTS_WITH;
  }

  // 3. Contains full query phrase
  if (normalizedTitle.includes(normalizedQuery)) {
    return SCORE_CONTAINS_PHRASE;
  }

  // 4–6. Word-level matching
  if (queryWords.length > 0) {
    const matchedCount = queryWords.filter(w => normalizedTitle.includes(w)).length;
    const ratio = matchedCount / queryWords.length;

    if (ratio === 1) {
      // Contains ALL query words
      return SCORE_CONTAINS_ALL;
    }
    if (ratio >= 0.5) {
      // Contains MOST query words (≥50%)
      return SCORE_CONTAINS_MOST;
    }
    if (matchedCount > 0) {
      // Contains SOME query words
      return SCORE_CONTAINS_SOME;
    }
  }

  // 7. Related — no meaningful match
  return 0;
}

/**
 * Rank an array of live-scraped products by relevance to the query.
 *
 * Returns a NEW sorted array. The original array is NOT mutated.
 * Products with the same score retain their original relative order (stable sort).
 *
 * @param {Array} products  Array of product objects from the live scraper.
 * @param {string} query    The user's search query (raw or pre-normalized).
 * @returns {Array} A new array sorted by descending relevance score.
 */
function rankLiveResults(products, query) {
  if (!products || products.length === 0) return products || [];
  if (!query || !query.trim()) return [...products];

  const normalizedQuery = normalize(query);
  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter(w => w.length > 0);

  // Attach scores, sort descending, strip scores.
  return products
    .map((product, originalIndex) => ({
      product,
      score: scoreProduct(product, normalizedQuery, queryWords),
      originalIndex,            // preserve original order as tiebreaker
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIndex - b.originalIndex;   // stable tiebreak
    })
    .map(entry => entry.product);
}

module.exports = { rankLiveResults };
