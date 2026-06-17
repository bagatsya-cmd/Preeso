const fs = require('fs');
const path = require('path');
const browserManager = require('./backend/src/utils/browserManager');

const SNAPSHOT_DIR = path.join(__dirname, 'debug-snapshots');

async function testRelianceParsing(page, filename) {
  console.log(`\nTesting Reliance parsing for: ${filename}`);
  const html = fs.readFileSync(path.join(SNAPSHOT_DIR, filename), 'utf8');
  await page.setContent(html);

  const result = await page.evaluate(() => {
    const detailAnchors = Array.from(document.querySelectorAll('a.details-container'));
    const items = [];

    for (const anchor of detailAnchors.slice(0, 3)) {
      const divs = Array.from(anchor.querySelectorAll('div'));
      const titleEl = divs.find(d => {
        if (d.childElementCount !== 0) return false;
        const t = d.textContent.trim();
        return t.length > 5 && /[a-z]/.test(t);
      });
      const title = titleEl ? titleEl.textContent.trim() : 'NOT_FOUND';

      const allText = anchor.innerText || anchor.textContent || '';
      const priceMatch = allText.match(/₹\s?[\d,]+(?:\.\d{0,2})?/);
      const price = priceMatch ? priceMatch[0] : 'NOT_FOUND';

      const parent = anchor.parentElement;
      const grandparent = parent ? parent.parentElement : null;
      const imgAnchor = grandparent ? grandparent.querySelector('a.product-card-image') : null;
      const imgEl = imgAnchor ? imgAnchor.querySelector('img') : null;

      items.push({
        title,
        price,
        parentTag: parent ? parent.tagName : null,
        parentClass: parent ? parent.className : null,
        grandparentTag: grandparent ? grandparent.tagName : null,
        grandparentClass: grandparent ? grandparent.className : null,
        imgAnchorFound: !!imgAnchor,
        imgElFound: !!imgEl,
        imgSrc: imgEl ? imgEl.getAttribute('src') : null,
        imgDataSrc: imgEl ? imgEl.getAttribute('data-src') : null,
        imgSrcset: imgEl ? imgEl.getAttribute('srcset') : null
      });
    }
    return { count: detailAnchors.length, items };
  });

  console.log(`Found a.details-container: ${result.count}`);
  result.items.forEach((item, idx) => {
    console.log(`  [Card ${idx + 1}] Title: "${item.title}" | Price: "${item.price}"`);
    console.log(`    Parent: <${item.parentTag}> class="${item.parentClass}"`);
    console.log(`    Grandparent: <${item.grandparentTag}> class="${item.grandparentClass}"`);
    console.log(`    Image: Anchor=${item.imgAnchorFound}, ImgEl=${item.imgElFound}, Src="${item.imgSrc}", DataSrc="${item.imgDataSrc}"`);
  });
}

async function testFlipkartParsing(page, filename) {
  console.log(`\nTesting Flipkart parsing for: ${filename}`);
  const html = fs.readFileSync(path.join(SNAPSHOT_DIR, filename), 'utf8');
  await page.setContent(html);

  const result = await page.evaluate(() => {
    const products = Array.from(document.querySelectorAll('div[data-id]'));
    const items = [];

    for (const element of products.slice(0, 3)) {
      const brandEl = element.querySelector('div.Fo1I0b, div._2WkVRV, div.hGSR34');
      const brand = brandEl ? brandEl.textContent.trim() : 'NOT_FOUND';
      
      let title = null;
      const linkEl = element.querySelector('a.atJtCj, a.CGtC98, a._1fQZEK, a.IRpwTa, a.WKTcLC, a._2mylwZ, a._2Uzu5x');
      if (linkEl) {
        title = linkEl.getAttribute('title') || linkEl.textContent.trim();
      }

      const priceEl = element.querySelector('div.hZ3P6w, div._30jeq3, div.Nx9bqj, div._1vC4OI');
      const origEl = element.querySelector('div.kRYCnD, div._3I9_wc, div.yRaY8j, div._3etB12');

      items.push({
        brand,
        title: title || 'NOT_FOUND',
        priceText: priceEl ? priceEl.textContent.trim() : 'NOT_FOUND',
        origText: origEl ? origEl.textContent.trim() : 'NOT_FOUND'
      });
    }
    return { count: products.length, items };
  });

  console.log(`Found div[data-id]: ${result.count}`);
  result.items.forEach((item, idx) => {
    console.log(`  [Card ${idx + 1}] Brand: "${item.brand}" | Title: "${item.title}"`);
    console.log(`    Price: "${item.priceText}" | Original Price: "${item.origText}"`);
  });
}

async function run() {
  const files = fs.readdirSync(SNAPSHOT_DIR);
  console.log('Files in snapshots dir:', files);

  const page = await browserManager.getPage(null, true);
  try {
    const relianceFile = files.find(f => f.startsWith('reliance-iphone-15-cover'));
    if (relianceFile) await testRelianceParsing(page, relianceFile);

    const flipkartFile = files.find(f => f.startsWith('flipkart-run1'));
    if (flipkartFile) await testFlipkartParsing(page, flipkartFile);
  } finally {
    await page.close();
    await browserManager.closeBrowser();
  }
}

run();
