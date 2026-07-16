/**
 * catalogVerification.js
 * 
 * Standalone catalog verification script.
 * Scrapes 5 target queries across all retailers and prints retailer-level image coverage KPIs.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const browserManager = require('../utils/browserManager');
const flipkartScraper = require('../scrapers/flipkart');
const myntraScraper = require('../scrapers/myntra');
const ajioScraper = require('../scrapers/ajio');
const nykaaScraper = require('../scrapers/nykaa');
const relianceScraper = require('../scrapers/reliance');
const amazonScraper = require('../scrapers/amazon');

const TEST_QUERIES = ['iphone 15', 'laptop', 'shoes', 'shampoo', 'backpack'];

const SCRAPERS = [
  { name: 'Flipkart', scraper: flipkartScraper },
  { name: 'AJIO', scraper: ajioScraper },
  { name: 'Nykaa', scraper: nykaaScraper },
  { name: 'Myntra', scraper: myntraScraper },
  { name: 'Reliance Digital', scraper: relianceScraper },
  { name: 'Amazon', scraper: amazonScraper }
];

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing in environment.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  const stats = {};
  for (const s of SCRAPERS) {
    stats[s.name] = {
      totalProducts: 0,
      totalWithImages: 0,
      totalDurationsMs: 0,
      runs: 0
    };
  }

  console.log(`\n🚀 Starting verification run for queries: [${TEST_QUERIES.join(', ')}]\n`);

  for (const query of TEST_QUERIES) {
    console.log(`\n🔍 ========================================================`);
    console.log(`🔍 QUERY: "${query}"`);
    console.log(`🔍 ========================================================`);

    for (const { name, scraper } of SCRAPERS) {
      // If Amazon is disabled via env, skip it
      if (name === 'Amazon' && process.env.ENABLE_AMAZON !== 'true') {
        continue;
      }

      console.log(`\n[${name}] Scrapes starting for query: "${query}"...`);
      const start = Date.now();
      let results = [];
      try {
        results = await scraper.search(query) || [];
      } catch (err) {
        console.error(`❌ [${name}] Scrape failed:`, err.message);
      }
      const duration = Date.now() - start;

      const productsWithImages = results.filter(r => r.image && typeof r.image === 'string' && r.image.trim().startsWith('http')).length;

      stats[name].totalProducts += results.length;
      stats[name].totalWithImages += productsWithImages;
      stats[name].totalDurationsMs += duration;
      stats[name].runs += 1;

      const coverage = results.length > 0 ? ((productsWithImages / results.length) * 100).toFixed(1) : '0.0';
      console.log(`[${name}] Finished. Extracted ${results.length} products. Image coverage: ${coverage}% (${productsWithImages}/${results.length}). Duration: ${(duration / 1000).toFixed(2)}s`);

      // Print first product sample if available
      if (results.length > 0) {
        const first = results[0];
        console.log(`  Sample product:`);
        console.log(`    Title: "${first.title.substring(0, 60)}..."`);
        console.log(`    Price: ₹${first.price}`);
        console.log(`    Image: ${first.image || 'MISSING'}`);
        console.log(`    Candidates: ${first.imageCandidates ? first.imageCandidates.length : 0} found`);
      }
    }
  }

  console.log(`\n📊 ========================================================`);
  console.log(`📊 FINAL REPORT - RETAILER-LEVEL KPI SUMMARY`);
  console.log(`📊 ========================================================`);
  console.log(String().padStart(78, '-'));
  console.log(
    'Retailer'.padEnd(20) + ' | ' +
    'Scraped'.padEnd(10) + ' | ' +
    'With Images'.padEnd(12) + ' | ' +
    'Coverage %'.padEnd(12) + ' | ' +
    'Avg Duration'.padEnd(12)
  );
  console.log(String().padStart(78, '-'));

  let grandTotalProducts = 0;
  let grandTotalWithImages = 0;

  for (const [name, data] of Object.entries(stats)) {
    // If Amazon was skipped entirely
    if (name === 'Amazon' && process.env.ENABLE_AMAZON !== 'true' && data.runs === 0) {
      continue;
    }

    const coverage = data.totalProducts > 0 ? ((data.totalWithImages / data.totalProducts) * 100).toFixed(1) : '0.0';
    const avgDuration = data.runs > 0 ? ((data.totalDurationsMs / data.runs) / 1000).toFixed(2) : '0.00';

    console.log(
      name.padEnd(20) + ' | ' +
      String(data.totalProducts).padEnd(10) + ' | ' +
      String(data.totalWithImages).padEnd(12) + ' | ' +
      `${coverage}%`.padEnd(12) + ' | ' +
      `${avgDuration}s`.padEnd(12)
    );

    grandTotalProducts += data.totalProducts;
    grandTotalWithImages += data.totalWithImages;
  }

  console.log(String().padStart(78, '-'));
  const overallCoverage = grandTotalProducts > 0 ? ((grandTotalWithImages / grandTotalProducts) * 100).toFixed(1) : '0.0';
  console.log(
    'OVERALL TOTAL'.padEnd(20) + ' | ' +
    String(grandTotalProducts).padEnd(10) + ' | ' +
    String(grandTotalWithImages).padEnd(12) + ' | ' +
    `${overallCoverage}%`.padEnd(12) + ' | ' +
    'N/A'
  );
  console.log(String().padStart(78, '-'));

  console.log('\n🧹 Cleaning up browser & database connections...');
  await browserManager.closeBrowser();
  await mongoose.connection.close();
  console.log('✅ Finished.');
}

main().catch(err => {
  console.error('Fatal error in verification:', err);
  process.exit(1);
});
