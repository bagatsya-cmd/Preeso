const mongoose = require('mongoose');

const PricePointSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  price: Number,
  storeName: String
});

const StoreSchema = new mongoose.Schema({
  storeName: { type: String, required: true },
  price: Number,
  originalPrice: Number,
  discount: Number,
  rating: Number,
  reviewCount: Number,
  delivery: String,
  deliveryDays: Number,
  link: String,
  image: String,
  inStock: { type: Boolean, default: true }
});

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  brand: String,
  category: String,
  description: String,
  image: String,
  searchQuery: { type: String, index: true },
  stores: [StoreSchema],
  priceHistory: [PricePointSchema],
  lowestPrice: Number,
  highestPrice: Number,
  bestStore: String,
  tags: [String],
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Auto-compute lowest/highest/bestStore before saving
ProductSchema.pre('save', function (next) {
  if (this.stores && this.stores.length > 0) {
    const validStores = this.stores.filter(s => s.price && s.inStock);
    if (validStores.length > 0) {
      const prices = validStores.map(s => s.price);
      this.lowestPrice = Math.min(...prices);
      this.highestPrice = Math.max(...prices);
      const best = validStores.reduce((a, b) => a.price < b.price ? a : b);
      this.bestStore = best.storeName;
    }
    this.lastUpdated = new Date();
  }
  next();
});

module.exports = mongoose.model('Product', ProductSchema);