const mongoose = require('mongoose');
const Product = require('../models/product');
const User = require('../models/User');
const ProductResult = require('../models/productResult');
const ScrapeJob = require('../models/scrapeJob');
const { normalizeQuery } = require('../utils/queryNormalizer');
const { SCRAPING_ENABLED } = require('../config/features');

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

// Helper to generate 30-day price history for a store
function generatePriceHistory(storeName, currentPrice) {
  const history = [];
  let price = currentPrice * 1.15;
  for (let i = 30; i >= 0; i--) {
    price = price + (Math.random() - 0.48) * currentPrice * 0.03;
    price = Math.max(currentPrice * 0.85, Math.min(price, currentPrice * 1.25));
    history.push({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      price: Math.round(price),
      storeName
    });
  }
  // Last point is always current price
  history[history.length - 1].price = currentPrice;
  return history;
}

// GET /api/products/search?query=
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const normalizedQuery = normalizeQuery(query);
    const queryKey = normalizedQuery.replace(/\s+/g, '_');

    if (!SCRAPING_ENABLED) {
      const cachedResult = await ProductResult.findOne({ queryKey }).lean();
      console.log(`[API Search] Read-only mode: queryKey="${queryKey}" resultCount=${cachedResult?.products?.length || 0}`);
      return res.json(cachedResult ? sanitizeProducts(cachedResult.products) : []);
    }

    // 1. Check DB cache
    const cachedResult = await ProductResult.findOne({ queryKey }).lean();
    console.log(`[DB RESULT] queryKey="${queryKey}" productResultsCount=${cachedResult?.products?.length || 0}`);
    
    const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;
    let isStale = true;
    if (cachedResult) {
      console.log(`[CACHE RESULT] queryKey="${queryKey}" resultCount=${cachedResult.products?.length || 0} createdAt="${new Date(cachedResult.updatedAt).toISOString()}"`);
      console.log("cacheHitKey", queryKey);
      const age = Date.now() - new Date(cachedResult.updatedAt).getTime();
      isStale = age > STALE_THRESHOLD_MS;
    }

    // 2. If missing or stale, trigger background scraper job
    if (!cachedResult || isStale) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const activeJob = await ScrapeJob.findOne({
        queryKey,
        status: { $in: ['pending', 'scraping', 'scraped', 'aggregating'] },
        updatedAt: { $gte: fifteenMinutesAgo }
      });
      console.log(`[JOB CHECK] queryKey="${queryKey}" jobFound=${activeJob ? true : false} jobStatus="${activeJob ? activeJob.status : 'none'}"`);

      if (!activeJob) {
        console.log(`[API Search] Enqueuing background job for queryKey: "${queryKey}"`);
        await ScrapeJob.create({
          query: normalizedQuery,
          queryKey,
          status: 'pending'
        });
      }
    }

    // 3. Immediately return cached products (or empty array if none)
    return res.json(cachedResult ? sanitizeProducts(cachedResult.products) : []);
  } catch (err) {
    console.error('[API Search] Error:', err);
    res.status(500).json({ message: 'Server error during search pipeline' });
  }
};


// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/products/trending
exports.getTrending = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ lastUpdated: -1 }).limit(8);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/products/:id/alert  (auth required)
exports.setAlert = async (req, res) => {
  try {
    const { targetPrice, storeName } = req.body;
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const user = await User.findById(req.user.id);
    // Remove existing alert for same product
    user.alerts = user.alerts.filter(a => a && a.productId?.toString() !== productId);
    user.alerts.push({ productId, productName: product.name, targetPrice: Number(targetPrice), storeName });
    await user.save();
    res.json({ message: 'Alert set successfully', alert: user.alerts[user.alerts.length - 1] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err?.message });
  }
};

// GET /api/wishlist  (auth required)
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/wishlist/:id  (auth required) — toggle
exports.toggleWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const productId = req.params.id;
    const productData = req.body.product;

    let dbProduct = null;

    // 1. Try to find the product in the database by its id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(productId)) {
      dbProduct = await Product.findById(productId);
    }

    // 2. If not found by ID, try searching by name/title from productData
    if (!dbProduct && productData) {
      const nameToSearch = productData.name || productData.baseName;
      if (nameToSearch) {
        dbProduct = await Product.findOne({ name: nameToSearch });
      }
    }

    // 3. If still not found and we have product details, dynamically create it
    if (!dbProduct && productData) {
      const priceHistory = [];
      if (productData.stores && productData.stores.length > 0) {
        productData.stores.forEach(store => {
          priceHistory.push(...generatePriceHistory(store.storeName, store.price));
        });
      }

      dbProduct = new Product({
        name: productData.name || productData.baseName,
        brand: productData.brand || 'Unknown',
        category: productData.category || 'General',
        description: productData.description || productData.name || productData.baseName,
        image: productData.image || productData.imageUrl,
        stores: productData.stores || [],
        searchQuery: (productData.category || 'General').toLowerCase(),
        priceHistory
      });
      await dbProduct.save();
    }

    if (!dbProduct) {
      return res.status(404).json({ message: 'Product not found and no details provided to save it.' });
    }

    const dbProductId = dbProduct._id;
    const idx = user.favorites.findIndex(id => id && id.toString() === dbProductId.toString());
    let action;

    if (idx > -1) {
      user.favorites.splice(idx, 1);
      action = 'removed';
    } else {
      user.favorites.push(dbProductId);
      action = 'added';
    }

    await user.save();
    res.json({
      message: `Product ${action} from wishlist`,
      action,
      productId: dbProductId
    });
  } catch (err) {
    console.error('Wishlist error:', err);
    res.status(500).json({ message: 'Server error', error: err?.message });
  }
};

// GET /api/products/:id/alerts  (auth required)
exports.getUserAlerts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user.alerts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/products/history/view/:id (auth required)
exports.recordView = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const productId = req.params.id;
    // Remove if already exists to put it at the end
    user.viewHistory = user.viewHistory.filter(id => id.toString() !== productId);
    user.viewHistory.push(productId);
    // Keep only last 20
    if (user.viewHistory.length > 20) user.viewHistory.shift();
    await user.save();
    res.json({ message: 'View recorded' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/products/history/search (auth required)
exports.recordSearch = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: 'Query required' });
    const user = await User.findById(req.user.id);
    user.searchHistory = user.searchHistory.filter(q => q !== query);
    user.searchHistory.push(query);
    if (user.searchHistory.length > 10) user.searchHistory.shift();
    await user.save();
    res.json({ message: 'Search recorded' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/products/user/recommendations (auth required)
exports.getRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('viewHistory');
    
    // Get categories or tags from viewed products
    const viewedCategories = user.viewHistory.filter(p => p).map(p => p.category).filter(Boolean);
    const uniqueCategories = [...new Set(viewedCategories)];
    
    let recommendations = [];
    if (uniqueCategories.length > 0) {
      recommendations = await Product.find({
        category: { $in: uniqueCategories },
        _id: { $nin: user.viewHistory.map(p => p._id) }
      }).limit(10).sort({ lastUpdated: -1 });
    }
    
    // Fallback if not enough recommendations
    if (recommendations.length < 5) {
      const trending = await Product.find({ _id: { $nin: user.viewHistory.map(p => p._id) }}).sort({ lastUpdated: -1 }).limit(10 - recommendations.length);
      recommendations = [...recommendations, ...trending];
    }
    
    // Deduplicate just in case
    const uniqueRecs = [];
    const seen = new Set();
    for (const r of recommendations) {
      if (!seen.has(r._id.toString())) {
        seen.add(r._id.toString());
        uniqueRecs.push(r);
      }
    }

    res.json(uniqueRecs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err?.message });
  }
};