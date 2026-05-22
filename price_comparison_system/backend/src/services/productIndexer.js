/**
 * Product Indexer — MongoDB persistence layer for search results.
 * Before live scraping, checks if we have fresh indexed data (<6h).
 * After scraping, silently upserts updated results in the background.
 */

const mongoose = require('mongoose');
const logger   = require('../utils/logger');

// ── Schema ────────────────────────────────────────────────────────────────────
const productIndexSchema = new mongoose.Schema({
  queryKey:        { type: String, required: true, index: true, unique: true },
  normalizedTitle: String,
  tokens:          [String],
  products:        { type: mongoose.Schema.Types.Mixed, default: [] },
  lowestPrice:     Number,
  imageUrl:        String,
  updatedAt:       { type: Date, default: Date.now },
}, { timestamps: false });

// TTL index: MongoDB auto-deletes records after 24h
productIndexSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

let IndexModel;
function getModel() {
  if (IndexModel) return IndexModel;
  try {
    IndexModel = mongoose.model('ProductIndex');
  } catch (_) {
    IndexModel = mongoose.model('ProductIndex', productIndexSchema);
  }
  return IndexModel;
}

const FRESH_THRESHOLD_MS = 6 * 60 * 60 * 1000;  // 6 hours

class ProductIndexer {
  _isConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Check if we have fresh indexed results for this query.
   * Returns the cached products array or null if stale/missing.
   */
  async getFreshResults(query) {
    if (!this._isConnected()) return null;
    try {
      const key = query.toLowerCase().trim();
      const doc = await getModel().findOne({ queryKey: key }).lean();
      if (!doc) return null;

      const age = Date.now() - new Date(doc.updatedAt).getTime();
      if (age > FRESH_THRESHOLD_MS) {
        logger.info('Indexer', `Stale index for "${query}" (${Math.round(age / 60000)}min old)`);
        return null;
      }

      logger.info('Indexer', `Fresh index hit for "${query}" (${Math.round(age / 60000)}min old, ${doc.products.length} products)`);
      return doc.products;
    } catch (err) {
      logger.warn('Indexer', `Read error: ${err.message}`);
      return null;
    }
  }

  /**
   * Persist products for a query. Called in background — never awaited on hot path.
   */
  async saveResults(query, products) {
    if (!this._isConnected() || !products?.length) return;
    try {
      const key = query.toLowerCase().trim();
      const lowestPrice = Math.min(
        ...products.map(p => p.lowestPrice || p.stores?.[0]?.price || Infinity)
      );
      await getModel().findOneAndUpdate(
        { queryKey: key },
        {
          queryKey: key,
          products,
          lowestPrice: isFinite(lowestPrice) ? lowestPrice : null,
          imageUrl:    products[0]?.imageUrl || products[0]?.image || null,
          updatedAt:   new Date(),
        },
        { upsert: true, new: true }
      );
      logger.info('Indexer', `Saved ${products.length} products for "${query}"`);
    } catch (err) {
      logger.warn('Indexer', `Write error: ${err.message}`);
    }
  }
}

module.exports = new ProductIndexer();
