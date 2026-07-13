const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ScrapedProduct = require('../src/models/scrapedProduct');

async function run() {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  const sources = ['flipkart', 'myntra', 'ajio', 'reliance', 'nykaa', 'amazon'];

  // ── 1. Overall with/without images ──────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('  SECTION 1: PRODUCTS WITH vs WITHOUT IMAGES');
  console.log('═══════════════════════════════════════════════');

  let grandTotal = 0, grandWithImage = 0, grandWithout = 0;

  for (const src of sources) {
    const total = await ScrapedProduct.countDocuments({ source: src });
    const hasImageNonEmpty = await ScrapedProduct.countDocuments({
      source: src,
      image: { $ne: null, $ne: '', $exists: true }
    });
    // More precise: count those with a truthy, non-empty image
    const withImage = await ScrapedProduct.countDocuments({
      source: src,
      image: { $exists: true, $ne: null, $ne: '' },
      $expr: { $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] }
    });
    const without = total - withImage;

    grandTotal += total;
    grandWithImage += withImage;
    grandWithout += without;

    console.log(`  ${src.toUpperCase().padEnd(12)} | Total: ${String(total).padStart(5)} | With Image: ${String(withImage).padStart(5)} | Without: ${String(without).padStart(5)}`);
  }
  console.log(`  ${'GRAND TOTAL'.padEnd(12)} | Total: ${String(grandTotal).padStart(5)} | With Image: ${String(grandWithImage).padStart(5)} | Without: ${String(grandWithout).padStart(5)}`);
  console.log('');

  // ── 2. Failure analysis per retailer ────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('  SECTION 2: FAILURE CAUSE ANALYSIS');
  console.log('═══════════════════════════════════════════════');

  for (const src of sources) {
    // Get sample of products WITHOUT images
    const failedProducts = await ScrapedProduct.find({
      source: src,
      $or: [
        { image: null },
        { image: '' },
        { image: { $exists: false } }
      ]
    }).select('title image url source').limit(30).lean();

    if (failedProducts.length === 0) {
      console.log(`\n  ${src.toUpperCase()}: No image failures found.\n`);
      continue;
    }

    console.log(`\n  ${src.toUpperCase()}: ${failedProducts.length} sample failures (showing up to 10):`);

    // Categorize failures
    let nullCount = 0, emptyCount = 0, missingField = 0;
    for (const p of failedProducts) {
      if (p.image === undefined) missingField++;
      else if (p.image === null) nullCount++;
      else if (p.image === '') emptyCount++;
    }

    console.log(`    null: ${nullCount} | empty string: ${emptyCount} | field missing: ${missingField}`);

    // Show some samples
    for (const p of failedProducts.slice(0, 10)) {
      const shortTitle = p.title ? (p.title.length > 50 ? p.title.substring(0, 50) + '...' : p.title) : '<no title>';
      console.log(`    - "${shortTitle}"`);
      console.log(`      image field value: ${JSON.stringify(p.image)}`);
    }
  }

  // ── 3. Examine URLs of products WITH images per retailer ────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SECTION 3: IMAGE URL CDN PATTERNS');
  console.log('═══════════════════════════════════════════════');

  for (const src of sources) {
    const products = await ScrapedProduct.find({
      source: src,
      image: { $exists: true, $ne: null, $ne: '' },
      $expr: { $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] }
    }).select('image').limit(200).lean();

    if (products.length === 0) {
      console.log(`\n  ${src.toUpperCase()}: No images to analyze.`);
      continue;
    }

    // Extract domains from image URLs
    const domainCounts = {};
    for (const p of products) {
      try {
        const url = new URL(p.image);
        const domain = url.hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch (e) {
        domainCounts['INVALID_URL'] = (domainCounts['INVALID_URL'] || 0) + 1;
      }
    }

    // Sort domains by count
    const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
    console.log(`\n  ${src.toUpperCase()} (${products.length} images sampled):`);
    for (const [domain, count] of sorted.slice(0, 10)) {
      console.log(`    ${domain.padEnd(45)} ${count} (${((count / products.length) * 100).toFixed(1)}%)`);
    }
  }

  // ── 4. Check Reliance images for jiostore domains ───────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SECTION 4: RELIANCE - JIOSTORE CDN CHECK');
  console.log('═══════════════════════════════════════════════');

  const relianceWithImage = await ScrapedProduct.find({
    source: 'reliance',
    image: { $exists: true, $ne: null, $ne: '' },
    $expr: { $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] }
  }).select('image').lean();

  let jioCount = 0, otherCount = 0;
  for (const p of relianceWithImage) {
    const lower = (p.image || '').toLowerCase();
    if (lower.includes('jiostore') || lower.includes('cdn.jiostore')) {
      jioCount++;
    } else {
      otherCount++;
    }
  }
  console.log(`  Products with JioStore CDN images: ${jioCount}`);
  console.log(`  Products with other CDN images:    ${otherCount}`);

  // Check if any AJIO images use jiostore
  const ajioWithImage = await ScrapedProduct.find({
    source: 'ajio',
    image: { $exists: true, $ne: null, $ne: '' },
    $expr: { $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] }
  }).select('image').lean();

  let ajioJio = 0;
  for (const p of ajioWithImage) {
    const lower = (p.image || '').toLowerCase();
    if (lower.includes('jiostore') || lower.includes('cdn.jiostore')) {
      ajioJio++;
    }
  }
  console.log(`\n  AJIO products with JioStore CDN images: ${ajioJio}`);

  // ── 5. AJIO failure investigation - check if failed products have URLs ──
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SECTION 5: AJIO FAILURE INVESTIGATION');
  console.log('═══════════════════════════════════════════════');

  const ajioFailed = await ScrapedProduct.find({
    source: 'ajio',
    $or: [
      { image: null },
      { image: '' },
      { image: { $exists: false } }
    ]
  }).select('title url image').limit(20).lean();

  console.log(`  AJIO products without images (sample of ${ajioFailed.length}):`);
  for (const p of ajioFailed.slice(0, 15)) {
    const shortTitle = p.title ? (p.title.length > 60 ? p.title.substring(0, 60) + '...' : p.title) : '<no title>';
    const shortUrl = p.url ? (p.url.length > 80 ? p.url.substring(0, 80) + '...' : p.url) : '<no url>';
    console.log(`    Title: "${shortTitle}"`);
    console.log(`    URL:    ${shortUrl}`);
    console.log(`    Image:  ${JSON.stringify(p.image)}`);
    console.log('');
  }

  // ── 6. Flipkart failure investigation ───────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('  SECTION 6: FLIPKART FAILURE INVESTIGATION');
  console.log('═══════════════════════════════════════════════');

  const flipkartFailed = await ScrapedProduct.find({
    source: 'flipkart',
    $or: [
      { image: null },
      { image: '' },
      { image: { $exists: false } }
    ]
  }).select('title url image').limit(15).lean();

  console.log(`  Flipkart products without images (sample of ${flipkartFailed.length}):`);
  for (const p of flipkartFailed.slice(0, 10)) {
    const shortTitle = p.title ? (p.title.length > 60 ? p.title.substring(0, 60) + '...' : p.title) : '<no title>';
    console.log(`    Title: "${shortTitle}"`);
    console.log(`    Image:  ${JSON.stringify(p.image)}`);
    console.log('');
  }

  // Check if Flipkart successful images are consistent
  const flipkartSuccess = await ScrapedProduct.find({
    source: 'flipkart',
    image: { $exists: true, $ne: null, $ne: '' },
    $expr: { $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] }
  }).select('image').limit(20).lean();

  console.log(`\n  Flipkart successful images (sample of ${flipkartSuccess.length}):`);
  for (const p of flipkartSuccess.slice(0, 10)) {
    const shortUrl = p.image.length > 90 ? p.image.substring(0, 90) + '...' : p.image;
    console.log(`    ${shortUrl}`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

run().catch(console.error);
