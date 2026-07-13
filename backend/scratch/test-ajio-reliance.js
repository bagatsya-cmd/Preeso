const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const browserManager = require('../src/utils/browserManager');

const AJIO_URL = 'https://www.ajio.com/playnxt-happy-hoops-fun--fitness/p/4911857610_multi';
const RELIANCE_URL = 'https://www.reliancedigital.in/product/iphone-15-silicone-mobile-case-soft-mint-ltmi93-7537083';

async function testAjio(page) {
  console.log('\n--- Testing AJIO ---');
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-site': 'none',
    'sec-fetch-mode': 'navigate',
  });

  try {
    const response = await page.goto(AJIO_URL, { waitUntil: 'load', timeout: 15000 });
    console.log(`AJIO Status: ${response ? response.status() : 'N/A'}`);
    const title = await page.title();
    console.log(`AJIO Title: "${title}"`);
    const priceText = await page.evaluate(() => {
      const pEl = document.querySelector('.prod-sp') || document.querySelector('.price-info .prod-sp');
      return pEl ? pEl.textContent.trim() : 'NOT_FOUND';
    });
    console.log(`AJIO Extracted Price: ${priceText}`);
  } catch (e) {
    console.error(`AJIO Error: ${e.message}`);
  }
}

async function testReliance(page) {
  console.log('\n--- Testing Reliance ---');
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  try {
    const response = await page.goto(RELIANCE_URL, { waitUntil: 'load', timeout: 15000 });
    console.log(`Reliance Status: ${response ? response.status() : 'N/A'}`);
    const title = await page.title();
    console.log(`Reliance Title: "${title}"`);
    const priceText = await page.evaluate(() => {
      const pEl = document.querySelector('span.pdp__price') || document.querySelector('.pdp__price');
      return pEl ? pEl.textContent.trim() : 'NOT_FOUND';
    });
    console.log(`Reliance Extracted Price: ${priceText}`);
  } catch (e) {
    console.error(`Reliance Error: ${e.message}`);
  }
}

async function run() {
  // Use skipInterception = false to block images/css for speed and bypass tracker scripts
  const page = await browserManager.getPage(null, false);
  try {
    await testAjio(page);
    await testReliance(page);
  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
