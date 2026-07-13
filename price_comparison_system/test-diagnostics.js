const browserManager = require('./backend/src/utils/browserManager');
const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = path.join(__dirname, 'debug-snapshots');
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

async function testReliance() {
  console.log('\n=========================================');
  console.log('DIAGNOSTICS: RELIANCE DIGITAL');
  console.log('=========================================');

  const queries = ['iphone 15 cover', 'iphone 15 case', 'saree'];
  const page = await browserManager.getPage(null, true); // skipInterception = true

  try {
    for (const q of queries) {
      const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(q)}`;
      console.log(`\n[Reliance] Navigating to: ${url}`);
      
      let response = null;
      // Capture API responses
      const apiResponses = [];
      page.on('response', res => {
        const u = res.url();
        if (u.includes('/api/') || u.includes('/search') || u.includes('/products')) {
          apiResponses.push({ url: u, status: res.status() });
        }
      });

      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      } catch (err) {
        console.log(`[Reliance] Navigation timed out/failed: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 3000)); // wait for React hydration

      const title = await page.title();
      const content = await page.content();
      const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
      const containerCount = await page.evaluate(() => document.querySelectorAll('a.details-container').length);

      console.log(`[Reliance] Results for "${q}":`);
      console.log(`  Page Title: "${title}"`);
      console.log(`  HTML Length: ${content.length}`);
      console.log(`  Containers Found: ${containerCount}`);
      console.log(`  API Calls Captured: ${apiResponses.length}`);
      if (apiResponses.length > 0) {
        apiResponses.forEach(api => console.log(`    - ${api.url.substring(0, 100)}... (Status: ${api.status})`));
      }

      // Check if body says "No Products Found" or similar
      console.log(`  First 300 chars of body: ${bodyText.replace(/\s+/g, ' ').substring(0, 300)}`);
      
      const snapshotPath = path.join(SNAPSHOT_DIR, `reliance-${q.replace(/\s+/g, '-')}-${Date.now()}.html`);
      fs.writeFileSync(snapshotPath, content);
      console.log(`  Saved HTML snapshot to: ${snapshotPath}`);
    }
  } catch (err) {
    console.error('[Reliance] Test failed with error:', err);
  } finally {
    await page.close();
  }
}

async function testNykaa() {
  console.log('\n=========================================');
  console.log('DIAGNOSTICS: NYKAA');
  console.log('=========================================');

  const page = await browserManager.getPage(null); // skipInterception = false
  const url = 'https://www.nykaa.com/search/result/?q=saree&ptype=search&id=0';
  
  try {
    console.log(`[Nykaa] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 25000 }).catch(e => console.log(`[Nykaa] Navigation err: ${e.message}`));
    
    await new Promise(r => setTimeout(r, 3000));
    
    const finalUrl = page.url();
    const title = await page.title();
    const content = await page.content();
    const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');

    const containers = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="productId="]'));
      return links.length;
    });

    console.log('[Nykaa] Results for "saree":');
    console.log(`  Final URL: ${finalUrl}`);
    console.log(`  Title: "${title}"`);
    console.log(`  HTML Length: ${content.length}`);
    console.log(`  Containers Found: ${containers}`);
    console.log(`  Akamai Block? ${/akamai|challenge|access denied/i.test(title) || /access denied/i.test(bodyText)}`);
    console.log(`  First 300 chars of body: ${bodyText.replace(/\s+/g, ' ').substring(0, 300)}`);

    const snapshotPath = path.join(SNAPSHOT_DIR, `nykaa-saree-${Date.now()}.html`);
    fs.writeFileSync(snapshotPath, content);
    console.log(`  Saved HTML snapshot to: ${snapshotPath}`);
  } catch (err) {
    console.error('[Nykaa] Test failed:', err);
  } finally {
    await page.close();
  }
}

async function testFlipkart() {
  console.log('\n=========================================');
  console.log('DIAGNOSTICS: FLIPKART');
  console.log('=========================================');

  const page = await browserManager.getPage(null);
  const url = 'https://www.flipkart.com/search?q=saree';

  try {
    for (let i = 1; i <= 3; i++) {
      console.log(`\n[Flipkart] Run ${i} - Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'load', timeout: 20000 }).catch(e => console.log(`[Flipkart] Nav err: ${e.message}`));
      
      await new Promise(r => setTimeout(r, 2000));
      
      const title = await page.title();
      const content = await page.content();
      const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
      const containers = await page.evaluate(() => document.querySelectorAll('div[data-id]').length);

      console.log(`[Flipkart] Run ${i} Results:`);
      console.log(`  Title: "${title}"`);
      console.log(`  HTML Length: ${content.length}`);
      console.log(`  Containers Found: ${containers}`);
      console.log(`  First 300 chars of body: ${bodyText.replace(/\s+/g, ' ').substring(0, 300)}`);

      const snapshotPath = path.join(SNAPSHOT_DIR, `flipkart-run${i}-${Date.now()}.html`);
      fs.writeFileSync(snapshotPath, content);
    }
  } catch (err) {
    console.error('[Flipkart] Test failed:', err);
  } finally {
    await page.close();
  }
}

async function runAll() {
  try {
    await testReliance();
    await testNykaa();
    await testFlipkart();
  } finally {
    await browserManager.closeBrowser();
  }
}

runAll();
