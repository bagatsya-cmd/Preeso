const fs = require('fs');
const path = require('path');
const browserManager = require('../src/utils/browserManager');

const SNAPSHOT_DIR = path.join(__dirname, '..', '..', 'debug-snapshots');

async function inspectSnapshot(page, filename) {
  console.log(`\n================ Inspecting Attributes for ${filename} ================`);
  const html = fs.readFileSync(path.join(SNAPSHOT_DIR, filename), 'utf8');
  await page.setContent(html);

  const results = await page.evaluate(() => {
    const products = Array.from(document.querySelectorAll('div[data-id]'));
    const items = [];

    products.slice(0, 5).forEach((el, idx) => {
      const imgs = Array.from(el.querySelectorAll('img'));
      const imgList = imgs.map((img, imgIdx) => {
        const attributes = {};
        for (let i = 0; i < img.attributes.length; i++) {
          const attr = img.attributes[i];
          attributes[attr.name] = attr.value;
        }
        return {
          imgIdx: imgIdx + 1,
          attributes,
          parentTag: img.parentElement ? img.parentElement.tagName : null,
          parentClass: img.parentElement ? img.parentElement.className : null
        };
      });

      items.push({
        productIdx: idx + 1,
        imgsCount: imgs.length,
        imgs: imgList
      });
    });

    return { items };
  });

  results.items.forEach(item => {
    console.log(`\n[Product ${item.productIdx}] - Found ${item.imgsCount} images`);
    item.imgs.forEach(img => {
      console.log(`    - Img ${img.imgIdx}:`);
      console.log(`      Attributes:`, JSON.stringify(img.attributes, null, 2));
      console.log(`      Parent: <${img.parentTag}> class="${img.parentClass}"`);
    });
  });
}

async function run() {
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.startsWith('flipkart-run'));
  if (files.length === 0) {
    console.log('No Flipkart snapshot files found');
    return;
  }
  
  const page = await browserManager.getPage(null, true);
  try {
    await inspectSnapshot(page, files[0]);
  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
