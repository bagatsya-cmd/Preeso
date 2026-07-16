const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navigating to Nykaa...');
  await page.goto('https://www.nykaa.com/search/result/?q=shoes&ptype=search&id=0', { waitUntil: 'load', timeout: 30000 }).catch(() => {});

  const preloadedState = await page.evaluate(() => {
    return window.__PRELOADED_STATE__ || null;
  });

  if (!preloadedState) {
    console.log('__PRELOADED_STATE__ is not present on the window.');
  } else {
    console.log('Keys of __PRELOADED_STATE__:', Object.keys(preloadedState));
    
    // Let's search inside preloadedState for anything resembling a product list
    // Try searchListing or searchListingReducer or products
    const searchListing = preloadedState.searchListing || preloadedState.searchListingReducer || {};
    console.log('Keys of searchListing:', Object.keys(searchListing));

    // Let's write the entire state to a temporary JSON file so we can view it
    const fs = require('fs');
    fs.writeFileSync('scratch/nykaa_preloaded.json', JSON.stringify(preloadedState, null, 2));
    console.log('Wrote __PRELOADED_STATE__ to scratch/nykaa_preloaded.json');
  }

  await browser.close();
  process.exit(0);
})();
