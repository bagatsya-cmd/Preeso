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

    const s0nccfInfo = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.s0NCCf'));
      return cards.map((c, idx) => {
        const text = c.innerText ? c.innerText.substring(0, 200).replace(/\s+/g, ' ') : '';
        const img = c.querySelector('img');
        const imgTag = img ? img.outerHTML.substring(0, 300) : 'no img';
        
        // Let's also check all child anchors
        const anchors = Array.from(c.querySelectorAll('a')).map(a => ({
          className: a.className,
          href: a.getAttribute('href'),
          text: a.innerText.trim().substring(0, 50)
        }));

        return {
          idx: idx + 1,
          tagName: c.tagName,
          className: c.className,
          text,
          imgTag,
          anchors
        };
      });
    });

    console.log(`Found ${s0nccfInfo.length} .s0NCCf elements:`);
    s0nccfInfo.forEach(c => {
      console.log(`\nCard ${c.idx}: <${c.tagName}> class="${c.className}"`);
      console.log(`  Text: "${c.text}"`);
      console.log(`  Img:  ${c.imgTag}`);
      console.log(`  Anchors:`, c.anchors);
    });

  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
