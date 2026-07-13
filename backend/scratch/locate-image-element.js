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

    const matches = await page.evaluate(() => {
      const results = [];
      const queryStr = 'banarasi-saree-kalapushpi';
      
      // Find all elements containing this text or attribute
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        // Check attributes
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (attr.value.includes(queryStr) || attr.value.includes('imahmyz5zytztp8k')) {
            results.push({
              tagName: el.tagName,
              className: el.className,
              attrName: attr.name,
              attrVal: attr.value,
              outerHTML: el.outerHTML.substring(0, 300)
            });
          }
        }
      }
      return results;
    });

    console.log(`Found ${matches.length} matching elements:`);
    matches.forEach((m, idx) => {
      console.log(`\n[Match ${idx + 1}] Tag: <${m.tagName}> class="${m.className}"`);
      console.log(`  Attribute: ${m.attrName} = "${m.attrVal}"`);
      console.log(`  HTML: ${m.outerHTML}`);
    });

  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
