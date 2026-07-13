/**
 * LRU Search Cache — in-memory, zero dependencies.
 * Stores normalized product cards, raw partials, and image URLs.
 * TTL: 10 minutes for live results, 30 minutes for hot queries.
 */

const DEFAULT_TTL_MS  = 10 * 60 * 1000;  // 10 min
const HOT_TTL_MS      = 30 * 60 * 1000;  // 30 min
const MAX_ENTRIES     = 200;              // LRU eviction threshold

// Hot queries that get longer TTL and background refresh
const HOT_QUERIES = new Set([
  'iphone', 'iphone 15', 'iphone 16', 'samsung', 'samsung s25',
  'oneplus', 'redmi', 'realme', 'pixel',
  'macbook', 'laptop', 'airpods', 'earbuds',
  'nike', 'adidas', 'sneakers', 'shoes',
  'gaming', 'headphones',
]);

class SearchCache {
  constructor() {
    // Map preserves insertion order — we use it as an LRU by moving hits to end
    this._store = new Map();
  }

  _isHot(key) {
    const q = key.toLowerCase().trim();
    return HOT_QUERIES.has(q) || [...HOT_QUERIES].some(h => q.includes(h));
  }

  _ttl(key) {
    return this._isHot(key) ? HOT_TTL_MS : DEFAULT_TTL_MS;
  }

  // ── LRU eviction ────────────────────────────────────────────────────────────
  _evictOldest() {
    const firstKey = this._store.keys().next().value;
    if (firstKey !== undefined) this._store.delete(firstKey);
  }

  // ── Core operations ─────────────────────────────────────────────────────────
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > entry.ttl) {
      this._store.delete(key);
      return null;
    }
    // LRU: move to end (most recently used)
    this._store.delete(key);
    this._store.set(key, entry);
    return entry.data;
  }

  set(key, data) {
    if (this._store.size >= MAX_ENTRIES) this._evictOldest();
    this._store.set(key, { data, ts: Date.now(), ttl: this._ttl(key) });
  }

  isStale(key) {
    const entry = this._store.get(key);
    if (!entry) return true;
    const age = Date.now() - entry.ts;
    // Consider stale after 50% of TTL
    return age > entry.ttl * 0.5;
  }

  invalidate(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }

  // ── Typed namespaces ─────────────────────────────────────────────────────────
  // Merged/normalized final results
  getMerged(query)       { return this.get(`merged:${query.toLowerCase().trim()}`); }
  setMerged(query, data) { this.set(`merged:${query.toLowerCase().trim()}`, data); }
  isMergedStale(query)   { return this.isStale(`merged:${query.toLowerCase().trim()}`); }

  // Per-platform raw partials
  getPartial(query, platform)       { return this.get(`partial:${query.toLowerCase().trim()}:${platform}`); }
  setPartial(query, platform, data) { this.set(`partial:${query.toLowerCase().trim()}:${platform}`, data); }

  // Search query suggestions (longer-lived)
  getSuggestions(prefix)       { return this.get(`suggest:${prefix.toLowerCase().trim()}`); }
  setSuggestions(prefix, data) {
    // Suggestions can live longer — override TTL
    const key = `suggest:${prefix.toLowerCase().trim()}`;
    if (this._store.size >= MAX_ENTRIES) this._evictOldest();
    this._store.set(key, { data, ts: Date.now(), ttl: HOT_TTL_MS });
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  stats() {
    let valid = 0, stale = 0;
    for (const [k, v] of this._store) {
      if (Date.now() - v.ts > v.ttl) stale++;
      else valid++;
    }
    return { total: this._store.size, valid, stale, maxEntries: MAX_ENTRIES };
  }
}

module.exports = new SearchCache();
