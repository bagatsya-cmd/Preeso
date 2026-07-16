const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const flipkartScraper = require('./src/scrapers/flipkart');
const ScrapedProduct = require('./src/models/scrapedProduct');
const ProductResult = require('./src/models/productResult');
const matchingService = require('./src/services/matchingService');

const PLATFORM_NAME_MAP = {
  amazon:          'Amazon',
  flipkart:        'Flipkart',
  myntra:          'Myntra',
  reliance:        'Reliance Digital',
  ajio:            'AJIO',
  nykaa:           'Nykaa',
};

async function audit() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing');
    return;
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  console.log('\n========================================');
  console.log('STAGE 1: RETAILER SCRAPER OUTPUT');
  console.log('Running Flipkart scraper for "iphone 15"...');
  const scraperResults = await flipkartScraper.search('iphone 15');
  console.log(`Scraper returned ${scraperResults.length} products.`);

  if (scraperResults.length === 0) {
    console.log('Scraper returned 0 items. Cannot trace.');
    await mongoose.disconnect();
    return;
  }

  const sampleScraped = scraperResults[0];
  console.log('\n--- FIRST PRODUCT FROM SCRAPER ---');
  console.log('title:', sampleScraped.title);
  console.log('retailer:', sampleScraped.platform);
  console.log('image:', sampleScraped.image);
  console.log('imageUrl:', sampleScraped.imageUrl);
  console.log('images:', sampleScraped.images);
  console.log('candidateImages:', sampleScraped.candidateImages);

  console.log('\n========================================');
  console.log('STAGE 2: scraped_products DOCUMENT');
  // Simulate how scraperWorker saves it:
  const uniqueHash = 'audit_test_hash_' + Date.now();
  const dbItem = {
    title: sampleScraped.title,
    price: sampleScraped.price,
    image: sampleScraped.image || null,
    url: sampleScraped.link,
    source: 'flipkart',
    queryKey: 'iphone_15',
    scrapedAt: new Date(),
    uniqueHash: uniqueHash
  };
  
  // Insert it temporarily
  const insertedDoc = await ScrapedProduct.create(dbItem);
  console.log('\n--- TEMPORARILY INSERTED DOCUMENT ---');
  console.log('title:', insertedDoc.title);
  console.log('retailer:', insertedDoc.source);
  console.log('image:', insertedDoc.image);
  console.log('imageUrl:', insertedDoc.imageUrl);
  console.log('images:', insertedDoc.images);
  console.log('candidateImages:', insertedDoc.candidateImages);

  console.log('\n========================================');
  console.log('STAGE 3: aggregatorWorker INPUT');
  // aggregatorWorker reads the scraped products and maps them:
  const formattedRaw = [insertedDoc].map((doc) => ({
    title: doc.title,
    price: doc.price,
    image: doc.image || null,
    link: doc.url,
    platform: PLATFORM_NAME_MAP[doc.source.toLowerCase()] || doc.source,
    brand: 'Unknown',
    category: 'General'
  }));

  const sampleInput = formattedRaw[0];
  console.log('\n--- FORMATTED RAW PRODUCT (INPUT TO mergeProducts) ---');
  console.log('title:', sampleInput.title);
  console.log('retailer:', sampleInput.platform);
  console.log('image:', sampleInput.image);
  console.log('imageUrl:', sampleInput.imageUrl);
  console.log('images:', sampleInput.images);
  console.log('candidateImages:', sampleInput.candidateImages);

  console.log('\n========================================');
  console.log('STAGE 4 & 5: aggregatorWorker OUTPUT / product_results DOCUMENT');
  // mergeProducts is called:
  const groupedCards = matchingService.mergeProducts(formattedRaw, 'iphone 15');
  const sampleMerged = groupedCards[0];

  console.log('\n--- MERGED PRODUCT CARD (aggregatorWorker OUTPUT) ---');
  console.log('title:', sampleMerged.baseName);
  console.log('image:', sampleMerged.image);
  console.log('imageUrl:', sampleMerged.imageUrl);
  console.log('images:', sampleMerged.images);
  console.log('candidateImages:', sampleMerged.candidateImages);
  console.log('\n--- STORE ENTRY IN MERGED CARD ---');
  const sampleStore = sampleMerged.stores[0];
  console.log('storeName:', sampleStore.storeName);
  console.log('image:', sampleStore.image);
  console.log('imageUrl:', sampleStore.imageUrl);

  console.log('\n========================================');
  console.log('STAGE 6 & 7: API RESPONSE & SSE PAYLOAD');
  // Sanitizer is called:
  function sanitizeProducts(products) {
    return products.map(product => {
      const filteredStores = (product.stores || []).filter(s => s.storeName !== 'Amazon');
      if (filteredStores.length === 0) return null;
      return {
        ...product,
        stores: filteredStores,
        lowestPrice: Math.min(...filteredStores.map(s => s.price))
      };
    }).filter(Boolean);
  }
  
  const apiProducts = sanitizeProducts(groupedCards);
  const sampleApi = apiProducts[0];
  console.log('\n--- SANITIZED API/SSE RESPONSE PRODUCT ---');
  console.log('title:', sampleApi.baseName);
  console.log('image:', sampleApi.image);
  console.log('imageUrl:', sampleApi.imageUrl);
  console.log('images:', sampleApi.images);
  console.log('candidateImages:', sampleApi.candidateImages);
  console.log('\n--- SANITIZED API/SSE RESPONSE STORE ENTRY ---');
  console.log('storeName:', sampleApi.stores[0].storeName);
  console.log('image:', sampleApi.stores[0].image);
  console.log('imageUrl:', sampleApi.stores[0].imageUrl);

  console.log('\n========================================');
  console.log('STAGE 8 & 9: FRONTEND PRODUCT OBJECT & DOM RENDER');
  // Frontend buildCandidates mock:
  function buildCandidates(product) {
    const raw = [
      product.image,
      product.imageUrl,
      ...(product.stores || []).map(s => s.image),
      ...(product.stores || []).map(s => s.thumbnail),
    ];
    const seen = new Set();
    const unique = [];
    for (const u of raw) {
      if (!u || typeof u !== 'string') continue;
      const norm = u.trim().startsWith('//') ? 'https:' + u.trim() : u.trim();
      if (!norm.startsWith('http')) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      unique.push(norm);
    }
    return unique;
  }

  const frontendCandidates = buildCandidates(sampleApi);
  console.log('\n--- FRONTEND BUILD CANDIDATES ---');
  console.log('product.image:', sampleApi.image);
  console.log('product.imageUrl:', sampleApi.imageUrl);
  console.log('stores[0].image:', sampleApi.stores[0].image);
  console.log('frontend resolved candidates:', frontendCandidates);
  console.log('rendered DOM image element src:', frontendCandidates[0] || '📦 (fallback)');

  // Clean up
  await ScrapedProduct.deleteOne({ uniqueHash: uniqueHash });
  console.log('\nCleaned up temp database records.');
  await mongoose.disconnect();
}

audit().catch(console.error);
