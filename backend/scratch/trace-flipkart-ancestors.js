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

    const ancestorsInfo = await page.evaluate(() => {
      const img = document.querySelector('img.UCc1lI');
      if (!img) return null;

      const path = [];
      let cur = img;
      while (cur) {
        path.push({
          tagName: cur.tagName,
          className: cur.className,
          id: cur.id,
          dataId: cur.getAttribute('data-id')
        });
        cur = cur.parentElement;
      }
      return path;
    });

    if (!ancestorsInfo) {
      console.log('img.UCc1lI not found');
      return;
    }

    console.log('Ancestors path for img.UCc1lI (from child to root):');
    ancestorsInfo.forEach((node, idx) => {
      console.log(`  [${idx}] <${node.tagName}> class="${node.className}" id="${node.id || ''}" data-id="${node.dataId || ''}"`);
    });

  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
