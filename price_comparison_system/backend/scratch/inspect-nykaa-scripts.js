const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navigating to Nykaa...');
  await page.goto('https://www.nykaa.com/search/result/?q=shoes&ptype=search&id=0', { waitUntil: 'load', timeout: 30000 }).catch(() => {});

  // Extract all script contents and look for product data
  const scriptsInfo = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    return scripts.map((s, idx) => {
      const src = s.getAttribute('src') || '';
      const type = s.getAttribute('type') || '';
      const id = s.getAttribute('id') || '';
      const text = s.textContent || '';
      return { idx, src, type, id, length: text.length, snippet: text.substring(0, 300) };
    });
  });

  console.log('Script tags found on page:');
  scriptsInfo.forEach(s => {
    console.log(`Script #${s.idx}: src="${s.src}" type="${s.type}" id="${s.id}" length=${s.length}`);
    if (s.length > 0) {
      console.log(`  Snippet: ${s.snippet}\n`);
    }
  });

  // Let's also search window properties for any state objects
  const stateKeys = await page.evaluate(() => {
    const keys = [];
    for (const key in window) {
      if (key.startsWith('__') || key.includes('STATE') || key.includes('DATA') || key.includes('apollo')) {
        keys.push(key);
      }
    }
    return keys;
  });
  console.log('Global window state keys:', stateKeys);

  await browser.close();
  process.exit(0);
})();
