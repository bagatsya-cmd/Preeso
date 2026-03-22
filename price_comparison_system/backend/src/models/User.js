const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,
  targetPrice: Number,
  storeName: String,
  createdAt: { type: Date, default: Date.now },
  triggered: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: { type: String, default: 'User' },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  alerts: [AlertSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);