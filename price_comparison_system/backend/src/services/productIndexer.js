const ProductResult = require('../models/productResult');
const { normalizeQuery } = require('../utils/queryNormalizer');
const logger = require('../utils/logger');

const FRESH_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

class ProductIndexer {
  /**
   * Check if we have fresh indexed results for this query.
   * Returns the cached products array or null if stale/missing.
   */
  async getFreshResults(query) {
    try {
      const key = normalizeQuery(query).replace(/\s+/g, '_');
      const doc = await ProductResult.findOne({ queryKey: key }).lean();
      if (!doc) return null;

      const age = Date.now() - new Date(doc.updatedAt).getTime();
      if (age > FRESH_THRESHOLD_MS) {
        logger.info('Indexer', `Stale index for "${query}" (${Math.round(age / 60000)}min old)`);
        return null;
      }

      logger.info('Indexer', `Fresh index hit for "${query}" (${Math.round(age / 60000)}min old, ${doc.products?.length || 0} products)`);
      return doc.products;
    } catch (err) {
      logger.warn('Indexer', `Read error: ${err.message}`);
      return null;
    }
  }

  /**
   * Persist products for a query.
   */
  async saveResults(query, products) {
    if (!products?.length) return;
    try {
      const key = normalizeQuery(query).replace(/\s+/g, '_');
      const lowestPrice = Math.min(
        ...products.map(p => p.lowestPrice || p.stores?.[0]?.price || Infinity)
      );
      
      await ProductResult.findOneAndUpdate(
        { queryKey: key },
        {
          queryKey: key,
          products,
          lowestPrice: isFinite(lowestPrice) ? lowestPrice : null,
          imageUrl: products[0]?.imageUrl || products[0]?.image || null,
          updatedAt: new Date(),
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
