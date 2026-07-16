const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setJavaScriptEnabled(false);
  console.log('Navigating to "shoes" search with JS disabled...');
  await page.goto('https://www.flipkart.com/search?q=shoes', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  const outerHTMLs = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('div[data-id] img'));
    return imgs.map(img => img.outerHTML);
  });

  console.log(`Found ${outerHTMLs.length} images:`);
  console.log(outerHTMLs.slice(0, 15));

  await browser.close();
  process.exit(0);
})();
