const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Set user agent that matches a standard browser
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('Navigating to AJIO search for "shoes"...');
  const response = await page.goto('https://www.ajio.com/search/?text=shoes', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(err => {
    console.log('Navigation failed:', err.message);
  });

  const title = await page.title();
  const content = await page.content();
  console.log(`Page title: "${title}"`);
  console.log(`Content length: ${content.length}`);

  if (title.includes('Access Denied')) {
    console.log('AJIO bot block is active. Attempting fallback headers or inspection...');
  }

  const cards = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.rilrtl-products-list__item'));
    return els.map((card, idx) => {
      const allImgs = Array.from(card.querySelectorAll('img'));
      const images = allImgs.map(img => {
        const attrs = {};
        for (const attr of img.attributes) {
          attrs[attr.name] = attr.value;
        }
        return {
          src: img.src || '',
          class: img.className || '',
          attrs
        };
      });
      return { index: idx, images };
    });
  });

  console.log(`Found ${cards.length} AJIO product cards.`);
  if (cards.length > 0) {
    console.log('First card details:', JSON.stringify(cards[0], null, 2));
  }

  await browser.close();
  process.exit(0);
})();
