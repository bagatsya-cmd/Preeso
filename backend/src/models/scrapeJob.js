const mongoose = require('mongoose');

const ScrapeJobSchema = new mongoose.Schema({
  query:     { type: String, required: true },
  queryKey:  { type: String, required: true, index: true },
  status:    {
    type: String,
    required: true,
    enum: ['pending', 'running', 'scraping', 'scraped', 'aggregating', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  attempts:  { type: Number, default: 0 },
  needsAggregation: { type: Boolean, default: false, index: true },
  error:     { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
ScrapeJobSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ScrapeJob', ScrapeJobSchema);
