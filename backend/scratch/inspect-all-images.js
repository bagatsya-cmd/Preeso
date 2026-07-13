const fs = require('fs');
const path = require('path');
const browserManager = require('../src/utils/browserManager');

const SNAPSHOT_DIR = path.join(__dirname, '..', '..', 'debug-snapshots');

async function run() {
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.startsWith('flipkart-run3'));
  if (files.length === 0) {
    console.log('No Flipkart run3 snapshot found');
    return;
  }
  
  const page = await browserManager.getPage(null, true);
  try {
    const html = fs.readFileSync(path.join(SNAPSHOT_DIR, files[0]), 'utf8');
    await page.setContent(html);

    const imagesInfo = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map((img, idx) => ({
        idx: idx + 1,
        src: img.getAttribute('src'),
        dataSrc: img.getAttribute('data-src') || img.dataset?.src || img.getAttribute('data-original') || null,
        className: img.className,
        parentTag: img.parentElement ? img.parentElement.tagName : null,
        parentClass: img.parentElement ? img.parentElement.className : null
      }));
    });

    console.log(`Total <img> elements on the page: ${imagesInfo.length}`);
    const nonPlaceholders = imagesInfo.filter(img => {
      const src = img.src || '';
      const dataSrc = img.dataSrc || '';
      return !src.includes('placeholder') && !dataSrc.includes('placeholder');
    });

    console.log(`Total non-placeholder images: ${nonPlaceholders.length}`);
    console.log('\nSample non-placeholder images:');
    nonPlaceholders.slice(0, 15).forEach(img => {
      console.log(`[Img ${img.idx}] Class: "${img.className}"`);
      console.log(`  Src: "${img.src}"`);
      console.log(`  Data-Src: "${img.dataSrc}"`);
      console.log(`  Parent: <${img.parentTag}> class="${img.parentClass}"`);
    });
  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
