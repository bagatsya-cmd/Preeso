const Product = require('../models/product');
const User = require('../models/User');
const { searchAllPlatforms, findDemoProducts } = require('../services/scraper');

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

    // 1. Check DB cache (fresh within 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cached = await Product.find({
      searchQuery: { $regex: query, $options: 'i' },
      lastUpdated: { $gte: twoHoursAgo }
    }).limit(10);

    if (cached.length > 0) {
      return res.json(cached);
    }

    // 2. Fetch from scrapers (with demo fallback)
    const scraped = await searchAllPlatforms(query);

    if (!scraped || scraped.length === 0) {
      // 3. Fall back to any existing DB records
      const existing = await Product.find({ name: { $regex: query, $options: 'i' } }).limit(10);
      return res.json(existing);
    }

    // 4. Upsert products into MongoDB
    const saved = [];
    for (const item of scraped) {
      const priceHistory = [];
      for (const store of item.stores) {
        priceHistory.push(...generatePriceHistory(store.storeName, store.price));
      }

      const existing = await Product.findOne({ name: item.name });
      if (existing) {
        existing.stores = item.stores;
        existing.searchQuery = query.toLowerCase();
        // Append new price history points
        existing.priceHistory.push(...priceHistory.slice(-4));
        await existing.save();
        saved.push(existing);
      } else {
        const product = new Product({
          name: item.name,
          brand: item.brand,
          category: item.category,
          description: item.description || `${item.brand} ${item.name}`,
          image: item.image,
          stores: item.stores,
          searchQuery: query.toLowerCase(),
          tags: item.tags || [],
          priceHistory
        });
        await product.save();
        saved.push(product);
      }
    }

    res.json(saved);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Server error during search' });
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
    user.alerts = user.alerts.filter(a => a.productId?.toString() !== productId);
    user.alerts.push({ productId, productName: product.name, targetPrice: Number(targetPrice), storeName });
    await user.save();
    res.json({ message: 'Alert set successfully', alert: user.alerts[user.alerts.length - 1] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
    const idx = user.favorites.findIndex(id => id.toString() === productId);
    let action;
    if (idx > -1) {
      user.favorites.splice(idx, 1);
      action = 'removed';
    } else {
      user.favorites.push(productId);
      action = 'added';
    }
    await user.save();
    res.json({ message: `Product ${action} from wishlist`, action });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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
    const viewedCategories = user.viewHistory.map(p => p.category).filter(Boolean);
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
    res.status(500).json({ message: 'Server error' });
  }
};