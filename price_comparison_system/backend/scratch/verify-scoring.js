/**
 * verification script to search laptop, iphone, and shoes and log the selected image score and retailer details.
 */
const flipkartScraper = require('../src/scrapers/flipkart');
const ajioScraper = require('../src/scrapers/ajio');
const nykaaScraper = require('../src/scrapers/nykaa');
const mongoose = require('mongoose');

(async () => {
  // Connect to DB just in case scrapers need it
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/preeso';
  await mongoose.connect(mongoUri).catch(() => {});

  const queries = ['laptop', 'iphone 15', 'shoes'];

  for (const q of queries) {
    console.log(`\n==================================================`);
    console.log(`VERIFICATION SEARCH FOR: "${q}"`);
    console.log(`==================================================`);

    // Run Flipkart (electronics / general)
    if (q === 'iphone 15' || q === 'laptop' || q === 'shoes') {
      console.log('\n--- Running Flipkart Scraper ---');
      const fkResults = await flipkartScraper.search(q).catch(e => { console.error(e); return []; });
      if (fkResults && fkResults.length > 0) {
        const p = fkResults[0];
        console.log(`SELECTED PRODUCT: ${p.title}`);
        console.log(`SELECTED IMAGE URL: ${p.image}`);
        console.log(`SOURCE ATTR: ${p.sourceAttr}`);
      } else {
        console.log('No Flipkart results returned.');
      }
    }

    // Run AJIO (fashion)
    if (q === 'shoes') {
      console.log('\n--- Running AJIO Scraper ---');
      const ajioResults = await ajioScraper.search(q).catch(e => { console.error(e); return []; });
      if (ajioResults && ajioResults.length > 0) {
        const p = ajioResults[0];
        console.log(`SELECTED PRODUCT: ${p.title}`);
        console.log(`SELECTED IMAGE URL: ${p.image}`);
      } else {
        console.log('No AJIO results returned.');
      }
    }

    // Run Nykaa (beauty/fashion)
    if (q === 'shoes' || q === 'iphone 15') {
      // Use 'lipstick' instead of iphone for Nykaa beauty, or 'shoes' for Nykaa fashion
      const nykaaQuery = q === 'shoes' ? 'shoes' : 'lipstick';
      console.log(`\n--- Running Nykaa Scraper for "${nykaaQuery}" ---`);
      const nykaaResults = await nykaaScraper.search(nykaaQuery).catch(e => { console.error(e); return []; });
      if (nykaaResults && nykaaResults.length > 0) {
        const p = nykaaResults[0];
        console.log(`SELECTED PRODUCT: ${p.title}`);
        console.log(`SELECTED IMAGE URL: ${p.image}`);
      } else {
        console.log('No Nykaa results returned.');
      }
    }
  }

  await mongoose.disconnect().catch(() => {});
  console.log('\nVerification run finished.');
  process.exit(0);
})();
