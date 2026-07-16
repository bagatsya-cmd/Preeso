const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navigating...');
  await page.goto('https://www.flipkart.com/search?q=iphone+15', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  
  console.log('Waiting for div[data-id]...');
  await page.waitForSelector('div[data-id]', { timeout: 10000 }).catch(() => {});

  const imgs = await page.evaluate(() => {
    const allImgs = Array.from(document.querySelectorAll('div[data-id] img'));
    return allImgs.map((img, idx) => {
      const attrs = {};
      for (const attr of img.attributes) {
        attrs[attr.name] = attr.value;
      }
      attrs._index = idx;
      return attrs;
    });
  });

  console.log(`Found ${imgs.length} images.`);
  
  // Find any image with placeholder
  const placeholderImgs = imgs.filter(img => {
    const src = img.src || '';
    return src.includes('placeholder') || src.includes('placeholder_fcebae.svg');
  });
  console.log(`Found ${placeholderImgs.length} placeholders.`);
  if (placeholderImgs.length > 0) {
    console.log('SAMPLE PLACEHOLDER ATTRS:');
    console.log(JSON.stringify(placeholderImgs.slice(0, 5), null, 2));
  } else {
    console.log('SAMPLE FIRST 5 IMAGES ATTRS:');
    console.log(JSON.stringify(imgs.slice(0, 5), null, 2));
  }

  await browser.close();
  process.exit(0);
})();
