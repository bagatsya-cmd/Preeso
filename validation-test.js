const amazon = require('./backend/src/scrapers/amazon');
const flipkart = require('./backend/src/scrapers/flipkart');
const ajio = require('./backend/src/scrapers/ajio');
const myntra = require('./backend/src/scrapers/myntra');
const nykaa = require('./backend/src/scrapers/nykaa');
const reliance = require('./backend/src/scrapers/reliance');
const browserManager = require('./backend/src/utils/browserManager');

const QUERIES = [
  'saree',
  'mouse',
  'wireless mouse',
  'iphone 15 cover',
  'laptop stand'
];

const SCRAPERS = [
  { name: 'Amazon', instance: amazon },
  { name: 'Flipkart', instance: flipkart },
  { name: 'AJIO', instance: ajio },
  { name: 'Myntra', instance: myntra },
  { name: 'Nykaa', instance: nykaa },
  { name: 'Reliance Digital', instance: reliance }
];

async function validate() {
  console.log('='.repeat(80));
  console.log('STARTING SCRAPER RELIABILITY AND PARITY VALIDATION');
  console.log('='.repeat(80));

  const resultsTable = [];
  const startTotal = Date.now();

  for (const query of QUERIES) {
    console.log(`\nTesting query: "${query}"`);
    console.log('-'.repeat(80));

    for (const scraper of SCRAPERS) {
      console.log(`[Running] ${scraper.name} search for "${query}"...`);
      const start = Date.now();
      let products = [];
      let status = 'SUCCESS';
      let errorMsg = '';

      try {
        products = await scraper.instance.search(query);
      } catch (err) {
        status = 'FAILURE';
        errorMsg = err.message;
        console.error(`[Error] ${scraper.name} failed: ${err.message}`);
      }

      const duration = Date.now() - start;
      const count = products ? products.length : 0;

      if (count === 0 && status === 'SUCCESS') {
        status = 'ZERO_RESULTS';
      }

      resultsTable.push({
        query,
        retailer: scraper.name,
        count,
        duration,
        status,
        error: errorMsg
      });

      console.log(`[Finished] ${scraper.name} returned ${count} items in ${duration}ms (Status: ${status})`);
    }
  }

  const durationTotal = Date.now() - startTotal;

  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION COMPLETED. GENERATING REPORT REPORT SUMMARY');
  console.log('='.repeat(80));

  // Generate markdown report
  let report = '# Scraper Validation Report\n\n';
  report += `**Total validation run time**: ${(durationTotal / 1000).toFixed(2)}s\n\n`;
  report += '| Query | Retailer | Products Found | Time (ms) | Status | Error Details |\n';
  report += '| :--- | :--- | :---: | :---: | :---: | :--- |\n';

  for (const row of resultsTable) {
    report += `| ${row.query} | ${row.retailer} | ${row.count} | ${row.duration} | ${row.status} | ${row.error || 'N/A'} |\n`;
  }

  // Summary counts per retailer
  report += '\n## Summary Table\n\n';
  report += '| Retailer | Total Successes | Total Failures | Total Zero Results | Avg Time (ms) |\n';
  report += '| :--- | :---: | :---: | :---: | :---: |\n';

  for (const scraper of SCRAPERS) {
    const rows = resultsTable.filter(r => r.retailer === scraper.name);
    const successes = rows.filter(r => r.status === 'SUCCESS').length;
    const failures = rows.filter(r => r.status === 'FAILURE').length;
    const zeros = rows.filter(r => r.status === 'ZERO_RESULTS').length;
    const avgTime = Math.round(rows.reduce((sum, r) => sum + r.duration, 0) / rows.length);

    report += `| ${scraper.name} | ${successes} | ${failures} | ${zeros} | ${avgTime} |\n`;
  }

  console.log(report);

  // Close browser instance
  await browserManager.closeBrowser();
  process.exit(0);
}

validate().catch(async (err) => {
  console.error('Validation crashed:', err);
  await browserManager.closeBrowser();
  process.exit(1);
});
