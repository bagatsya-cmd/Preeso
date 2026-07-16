const mongoose = require('mongoose');

const ActiveCatalogSchema = new mongoose.Schema({
  queryKey: { type: String, required: true, unique: true },
  activeScrapeJobId: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActiveCatalog', ActiveCatalogSchema);
