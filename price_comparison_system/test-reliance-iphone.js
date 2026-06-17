const reliance = require('./backend/src/scrapers/reliance');
const browserManager = require('./backend/src/utils/browserManager');

async function run() {
  console.log('Testing Reliance Digital scraper directly for "iphone"...');
  try {
    const start = Date.now();
    const results = await reliance.search('iphone');
    const duration = Date.now() - start;
    console.log(`Reliance Digital returned: ${results.length} products in ${duration}ms`);
    results.forEach((p, idx) => {
      console.log(`  [${idx + 1}] "${p.title}" - ₹${p.price} (Image: ${p.image})`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browserManager.closeBrowser();
    process.exit(0);
  }
}

run();
