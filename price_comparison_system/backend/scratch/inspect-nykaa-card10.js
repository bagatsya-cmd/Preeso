const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navigating to Nykaa...');
  await page.goto('https://www.nykaa.com/search/result/?q=shoes&ptype=search&id=0', { waitUntil: 'load', timeout: 30000 }).catch(() => {});

  await page.waitForSelector('a[href*="/p/"]', { timeout: 10000 }).catch(() => {});

  // Wait 2 seconds without scrolling
  await new Promise(r => setTimeout(r, 2000));

  const cards = await page.evaluate(() => {
    const productLinks = Array.from(document.querySelectorAll(
      'a[href*="/p/"], a[href*="productId="], [data-test-id="product-card"] a, [class*="productWrapper"] a'
    )).filter(a => {
      const href = a.getAttribute('href') || '';
      return href.includes('/p/') || href.includes('productId=');
    });

    const seen = new Set();
    const uniqueLinks = productLinks.filter(a => {
      const h = a.getAttribute('href') || '';
      if (seen.has(h)) return false;
      seen.add(h);
      return true;
    });

    return uniqueLinks.map((linkEl, idx) => {
      let card = linkEl;
      for (let i = 0; i < 4; i++) {
        if (!card.parentElement) break;
        card = card.parentElement;
        if (card.querySelectorAll('img').length > 0 && card.querySelectorAll('h2, [class*="name"]').length > 0) break;
      }

      const imgs = Array.from(card.querySelectorAll('img')).map(img => {
        const attrs = {};
        for (const attr of img.attributes) {
          attrs[attr.name] = attr.value;
        }
        return {
          src: img.src,
          className: img.className,
          attrs
        };
      });

      return {
        index: idx,
        title: (linkEl.querySelector('h2') || card.querySelector('h2') || {textContent:''}).textContent.trim(),
        images: imgs
      };
    });
  });

  console.log('All card images:');
  cards.forEach(card => {
    console.log(`\nCard #${card.index}: ${card.title}`);
    card.images.forEach((img, i) => {
      console.log(`  Img #${i}: className="${img.className}"`);
      console.log(`    src: "${img.src}"`);
      console.log(`    attributes:`, JSON.stringify(img.attrs, null, 2));
    });
  });

  await browser.close();
  process.exit(0);
})();
