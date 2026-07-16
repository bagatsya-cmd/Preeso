/**
 * Forensic dump for ALL Nykaa product cards - find which cards have defaultSale images.
 * Read-only investigation.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setRequestInterception(true);
  page.on('request', req => req.continue());

  console.log('Navigating to Nykaa search for "shoes"...');
  await page.goto('https://www.nykaa.com/search/result/?q=shoes&ptype=search&id=0', { waitUntil: 'load', timeout: 30000 }).catch(() => {
    console.log('Navigation timed out, continuing...');
  });

  await page.waitForSelector('a[href*="/p/"]', { timeout: 10000 }).catch(() => {});

  // Scroll to load more
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 500));

  const allCards = await page.evaluate(() => {
    const productLinks = Array.from(document.querySelectorAll(
      'a[href*="/p/"], a[href*="productId="], [data-test-id="product-card"] a, [class*="productWrapper"] a'
    )).filter(a => {
      const href = a.getAttribute('href') || '';
      return href.includes('/p/') || href.includes('productId=');
    });

    // Deduplicate
    const seen = new Set();
    const uniqueLinks = productLinks.filter(a => {
      const h = a.getAttribute('href') || '';
      if (seen.has(h)) return false;
      seen.add(h);
      return true;
    });

    return uniqueLinks.slice(0, 12).map((linkEl, idx) => {
      // Replicate the exact walk-up logic from nykaa.js
      let card = linkEl;
      for (let i = 0; i < 4; i++) {
        if (!card.parentElement) break;
        card = card.parentElement;
        if (card.querySelectorAll('img').length > 0 && card.querySelectorAll('h2, [class*="name"]').length > 0) break;
      }

      const allImgs = Array.from(card.querySelectorAll('img'));
      const imgDetails = allImgs.map(img => ({
        src: img.src || img.getAttribute('src') || '',
        className: img.className || '',
        alt: img.getAttribute('alt') || ''
      }));

      // Title
      const h2El = linkEl.querySelector('h2') || card.querySelector('h2');
      const title = h2El ? h2El.textContent.trim() : linkEl.textContent.trim().split('\n')[0].trim();

      return {
        index: idx,
        title: title.substring(0, 60),
        cardTag: card.tagName,
        cardClass: card.className,
        totalImgs: allImgs.length,
        images: imgDetails
      };
    });
  });

  console.log(`\nTotal cards found: ${allCards.length}\n`);

  for (const card of allCards) {
    console.log(`\n======== Card #${card.index}: ${card.title} ========`);
    console.log(`Container: <${card.cardTag}> class="${card.cardClass}"`);
    console.log(`Total images in container: ${card.totalImgs}`);

    for (const img of card.images) {
      const isBad = img.src.includes('defaultSale') || img.src.includes('OnlyatNykaa') || 
                    img.src.includes('banner') || img.src.includes('promo') ||
                    img.src.includes('best2025') || img.src.includes('Editor_Pick');
      const isProduct = img.src.includes('catalog/product');
      const marker = isBad ? ' ⚠️ BAD' : (isProduct ? ' ✅ PRODUCT' : '');
      console.log(`  IMG: src=${img.src.substring(0, 100)}${marker}`);
      console.log(`       class="${img.className}" alt="${img.alt}"`);
    }
  }

  await browser.close();
  console.log('\nDone.');
  process.exit(0);
})();
