/**
 * Forensic DOM dump for Nykaa first product card.
 * No code modifications — read-only investigation.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Allow all requests through
  await page.setRequestInterception(true);
  page.on('request', req => req.continue());

  console.log('Navigating to Nykaa search for "shoes"...');
  await page.goto('https://www.nykaa.com/search/result/?q=shoes&ptype=search&id=0', { waitUntil: 'load', timeout: 30000 }).catch(() => {
    console.log('Navigation timed out, continuing with partial page...');
  });

  // Wait for product links
  await page.waitForSelector('a[href*="/p/"]', { timeout: 10000 }).catch(() => {
    console.log('Timeout waiting for product links');
  });

  const dump = await page.evaluate(() => {
    // Find first product card by walking up from a product link
    const productLinks = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    if (!productLinks.length) return null;

    const linkEl = productLinks[0];
    // Walk up to find card container
    let card = linkEl;
    for (let i = 0; i < 4; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      if (card.querySelectorAll('img').length > 0 && card.querySelectorAll('h2, [class*="name"]').length > 0) break;
    }

    const imgEls = Array.from(card.querySelectorAll('img'));
    const imagesInfo = imgEls.map(img => {
      const allAttrs = {};
      for (const attr of img.attributes) {
        allAttrs[attr.name] = attr.value;
      }
      return {
        tagName: img.tagName,
        className: img.className || '',
        src: img.src || '',
        srcset: img.getAttribute('srcset') || '',
        'data-src': img.getAttribute('data-src') || '',
        'data-srcset': img.getAttribute('data-srcset') || '',
        'data-lazy-src': img.getAttribute('data-lazy-src') || '',
        'data-image': img.getAttribute('data-image') || '',
        backgroundImage: img.style ? img.style.backgroundImage : '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        allAttributes: allAttrs
      };
    });

    // Also check for background-image on non-img elements
    const bgImages = [];
    const allEls = Array.from(card.querySelectorAll('*'));
    for (const el of allEls) {
      const bg = el.style && el.style.backgroundImage;
      if (bg && bg !== 'none' && bg !== '') {
        bgImages.push({ tag: el.tagName, className: el.className, backgroundImage: bg });
      }
    }

    return {
      cardTagName: card.tagName,
      cardClassName: card.className,
      outerHTML: card.outerHTML,
      linkHref: linkEl.getAttribute('href'),
      images: imagesInfo,
      bgImages: bgImages,
      totalImgCount: imgEls.length
    };
  });

  if (!dump) {
    console.log('Could not find any Nykaa product card on the page.');
  } else {
    console.log(`\n================ NYKAA CARD CONTAINER ================`);
    console.log(`Tag: ${dump.cardTagName}, Class: ${dump.cardClassName}`);
    console.log(`Link href: ${dump.linkHref}`);
    console.log(`Total img elements: ${dump.totalImgCount}`);

    console.log(`\n================ OUTER HTML ================`);
    console.log(dump.outerHTML);

    console.log(`\n================ ALL IMG ELEMENTS ================`);
    dump.images.forEach((img, idx) => {
      console.log(`\n--- Image #${idx} ---`);
      console.log(`className: ${img.className}`);
      console.log(`src: ${img.src}`);
      console.log(`srcset: ${img.srcset}`);
      console.log(`data-src: ${img['data-src']}`);
      console.log(`data-srcset: ${img['data-srcset']}`);
      console.log(`data-lazy-src: ${img['data-lazy-src']}`);
      console.log(`data-image: ${img['data-image']}`);
      console.log(`style.backgroundImage: ${img.backgroundImage}`);
      console.log(`naturalWidth: ${img.naturalWidth}`);
      console.log(`naturalHeight: ${img.naturalHeight}`);
      console.log(`All Attributes:`, JSON.stringify(img.allAttributes, null, 2));
    });

    if (dump.bgImages.length > 0) {
      console.log(`\n================ BACKGROUND IMAGES ================`);
      dump.bgImages.forEach((bg, idx) => {
        console.log(`${idx}: <${bg.tag}> class="${bg.className}" background-image: ${bg.backgroundImage}`);
      });
    }
  }

  // Now simulate what the extractor does
  console.log(`\n================ EXTRACTOR SIMULATION ================`);
  const extractorResult = await page.evaluate(() => {
    const productLinks = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    if (!productLinks.length) return null;
    const linkEl = productLinks[0];
    let card = linkEl;
    for (let i = 0; i < 4; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      if (card.querySelectorAll('img').length > 0 && card.querySelectorAll('h2, [class*="name"]').length > 0) break;
    }

    // Replicate selector order from imageExtractor
    const selectors = [
      '[data-test-id="product-card"] img',
      '[class*="productWrapper"] img',
      'a[href*="/p/"] img',
      'a[href*="productId="] img',
      'img[src*="nykaa"]', 'img[data-src*="nykaa"]',
      'img'  // fallback
    ];

    const results = [];
    for (const sel of selectors) {
      try {
        const imgs = Array.from(card.querySelectorAll(sel));
        for (const img of imgs) {
          const src = img.src || img.getAttribute('src') || '';
          results.push({
            selector: sel,
            src: src,
            className: img.className,
            alt: img.getAttribute('alt') || ''
          });
        }
      } catch (_) {}
    }

    return results;
  });

  if (extractorResult) {
    console.log(`\nSelector match results (in priority order):`);
    extractorResult.forEach((r, idx) => {
      const shortSrc = r.src.length > 80 ? r.src.substring(0, 80) + '...' : r.src;
      console.log(`${idx}: selector="${r.selector}" class="${r.className}" alt="${r.alt}" src=${shortSrc}`);
    });
  }

  await browser.close();
  console.log('\nDone.');
  process.exit(0);
})();
