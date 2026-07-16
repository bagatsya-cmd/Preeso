const mongoose = require('mongoose');

const ScrapedProductSchema = new mongoose.Schema({
  title:           { type: String, required: true, index: true },
  price:           { type: Number, required: true },
  image:           { type: String },
  imageCandidates: [{ url: String, attr: String, score: Number }],
  qualityScore:    { type: Number },
  url:             { type: String, required: true },
  source:          { type: String, required: true, enum: ['flipkart', 'myntra', 'ajio', 'nykaa', 'reliance', 'amazon'] },
  queryKey:        { type: String, required: true, index: true },
  scrapeJobId:     { type: String, required: true, index: true },
  scrapedAt:       { type: Date, default: Date.now, index: true },
  uniqueHash:      { type: String, required: true }
});

ScrapedProductSchema.index({ uniqueHash: 1, scrapeJobId: 1 }, { unique: true });

module.exports = mongoose.model('ScrapedProduct', ScrapedProductSchema);
