const mongoose = require('mongoose');

const ProductResultSchema = new mongoose.Schema({
  queryKey:    { type: String, required: true, unique: true, index: true },
  products:    { type: mongoose.Schema.Types.Mixed, default: [] }, // Array of grouped cards
  lowestPrice: { type: Number },
  imageUrl:    { type: String },
  updatedAt:   { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('ProductResult', ProductResultSchema);
