const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const networkRequests = [];
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    const lower = url.toLowerCase();
    if (lower.includes('jpg') || lower.includes('jpeg') || lower.includes('png') || lower.includes('webp') || lower.includes('image') || lower.includes('media')) {
      networkRequests.push({ url, method: req.method(), resourceType: req.resourceType() });
    }
    req.continue();
  });

  console.log('Navigating to Flipkart search for "iphone 15"...');
  await page.goto('https://www.flipkart.com/search?q=iphone+15', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  // Wait for the container selector to render
  await page.waitForSelector('div[data-id]', { timeout: 10000 }).catch(() => {
    console.log('Timeout waiting for div[data-id]');
  });

  const dump = await page.evaluate(() => {
    const card = document.querySelector('div[data-id]');
    if (!card) return null;

    const imgEls = Array.from(card.querySelectorAll('img'));
    const imagesInfo = imgEls.map(img => {
      const allAttrs = {};
      for (const attr of img.attributes) {
        allAttrs[attr.name] = attr.value;
      }
      return {
        className: img.className || '',
        src: img.src || '',
        srcset: img.getAttribute('srcset') || '',
        'data-src': img.getAttribute('data-src') || '',
        'data-srcset': img.getAttribute('data-srcset') || '',
        'data-lazy-src': img.getAttribute('data-lazy-src') || '',
        'data-image': img.getAttribute('data-image') || '',
        'data-image-url': img.getAttribute('data-image-url') || '',
        'data-image-id': img.getAttribute('data-image-id') || '',
        backgroundImage: img.style ? img.style.backgroundImage : '',
        allAttributes: allAttrs
      };
    });

    return {
      outerHTML: card.outerHTML,
      innerHTML: card.innerHTML,
      images: imagesInfo
    };
  });

  if (!dump) {
    console.log('Could not find any product card on the page.');
  } else {
    console.log('\n================ OUTER HTML ================');
    console.log(dump.outerHTML);

    console.log('\n================ innerHTML ================');
    console.log(dump.innerHTML);

    console.log('\n================ ALL IMG ELEMENTS AND ATTRIBUTES ================');
    dump.images.forEach((img, idx) => {
      console.log(`\n--- Image #${idx} ---`);
      console.log(`className: ${img.className}`);
      console.log(`src: ${img.src}`);
      console.log(`srcset: ${img.srcset}`);
      console.log(`data-src: ${img['data-src']}`);
      console.log(`data-srcset: ${img['data-srcset']}`);
      console.log(`data-lazy-src: ${img['data-lazy-src']}`);
      console.log(`data-image: ${img['data-image']}`);
      console.log(`data-image-url: ${img['data-image-url']}`);
      console.log(`data-image-id: ${img['data-image-id']}`);
      console.log(`style.backgroundImage: ${img.backgroundImage}`);
      console.log(`All Attributes:`, JSON.stringify(img.allAttributes, null, 2));
    });
  }

  console.log('\n================ NETWORK REQUESTS (IMAGE/MEDIA) ================');
  networkRequests.forEach((req, idx) => {
    console.log(`${idx}: ${req.method} | ${req.resourceType} | ${req.url}`);
  });

  await browser.close();
  console.log('\nDone.');
  process.exit(0);
})();
