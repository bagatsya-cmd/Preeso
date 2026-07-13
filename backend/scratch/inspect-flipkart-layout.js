const fs = require('fs');
const path = require('path');
const browserManager = require('../src/utils/browserManager');

const SNAPSHOT_DIR = path.join(__dirname, '..', '..', 'debug-snapshots');

async function run() {
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.startsWith('flipkart-run1'));
  if (files.length === 0) {
    console.log('No Flipkart snapshot found');
    return;
  }
  
  const page = await browserManager.getPage(null, true);
  try {
    const html = fs.readFileSync(path.join(SNAPSHOT_DIR, files[0]), 'utf8');
    await page.setContent(html);

    const layout = await page.evaluate(() => {
      const dataIdCards = document.querySelectorAll('[data-id]').length;
      const s0nccfCards = document.querySelectorAll('.s0NCCf').length;
      const uCc1lIImgs = document.querySelectorAll('img.UCc1lI').length;

      // Find first img.UCc1lI and get info about its closest parent with data-id or any other common wrapper
      const firstImg = document.querySelector('img.UCc1lI');
      let parentWithDataId = null;
      let parentWithAnchor = null;
      if (firstImg) {
        let cur = firstImg;
        while (cur) {
          if (cur.getAttribute('data-id')) {
            parentWithDataId = {
              tagName: cur.tagName,
              className: cur.className,
              dataId: cur.getAttribute('data-id')
            };
          }
          if (cur.tagName === 'A') {
            parentWithAnchor = {
              className: cur.className,
              href: cur.getAttribute('href')
            };
          }
          cur = cur.parentElement;
        }
      }

      return {
        dataIdCards,
        s0nccfCards,
        uCc1lIImgs,
        parentWithDataId,
        parentWithAnchor
      };
    });

    console.log('Flipkart snapshot stats:');
    console.log(`  Count of [data-id] elements: ${layout.dataIdCards}`);
    console.log(`  Count of .s0NCCf elements:   ${layout.s0nccfCards}`);
    console.log(`  Count of img.UCc1lI elements: ${layout.uCc1lIImgs}`);
    console.log('  For first img.UCc1lI:');
    console.log(`    Closest parent A:`, layout.parentWithAnchor);
    console.log(`    Closest parent with data-id:`, layout.parentWithDataId);

  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
