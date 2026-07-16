const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.goto('https://www.flipkart.com/search?q=iphone+15', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  const placeholdersInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[data-id]'));
    const results = [];
    cards.forEach((card, cardIdx) => {
      const imgs = Array.from(card.querySelectorAll('img'));
      imgs.forEach(img => {
        const src = img.src || '';
        if (src.includes('placeholder') || src.includes('placeholder_fcebae.svg')) {
          const allAttrs = {};
          for (const attr of img.attributes) {
            allAttrs[attr.name] = attr.value;
          }
          results.push({
            cardIndex: cardIdx,
            src: src,
            attributes: allAttrs
          });
        }
      });
    });
    return results;
  });

  console.log('PLACEHOLDERS FOUND BEFORE SCROLL:');
  console.log(JSON.stringify(placeholdersInfo, null, 2));

  await browser.close();
  process.exit(0);
})();
