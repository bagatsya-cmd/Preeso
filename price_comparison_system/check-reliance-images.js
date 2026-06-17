const browserManager = require('./backend/src/utils/browserManager');

async function check() {
  const url = 'https://www.reliancedigital.in/products?q=iphone';
  console.log(`Navigating to: ${url}`);
  const page = await browserManager.getPage(null, true);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('a.details-container', { timeout: 10000 });

    const imgAttributes = await page.evaluate(() => {
      const items = [];
      const detailAnchors = Array.from(document.querySelectorAll('a.details-container'));
      for (const anchor of detailAnchors.slice(0, 3)) {
        const parent = anchor.parentElement;
        const imgAnchor = parent ? parent.querySelector('a.product-card-image') : null;
        const imgEl = imgAnchor ? imgAnchor.querySelector('img') : null;
        if (imgEl) {
          items.push({
            src: imgEl.getAttribute('src'),
            srcset: imgEl.getAttribute('srcset'),
            dataSrc: imgEl.getAttribute('data-src'),
            currentSrc: imgEl.currentSrc
          });
        } else {
          items.push({ no_img: true });
        }
      }
      return items;
    });

    console.log('Image attributes on page:', imgAttributes);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await page.close();
    await browserManager.closeBrowser();
  }
}

check();
