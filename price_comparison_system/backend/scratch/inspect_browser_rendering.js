const puppeteer = require('puppeteer');

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Listen for console logs
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.text()}`);
  });

  // Listen for page errors
  page.on('pageerror', err => {
    console.log(`[BROWSER ERROR] ${err.toString()}`);
  });

  // Listen for network requests to trace images
  page.on('request', req => {
    const url = req.url();
    if (url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i) || url.includes('image') || url.includes('myntassets') || url.includes('flixcart')) {
      console.log(`[BROWSER REQ] ${req.method()} ${url.substring(0, 100)}`);
    }
  });

  page.on('requestfailed', req => {
    const url = req.url();
    if (url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i) || url.includes('image')) {
      console.log(`[BROWSER REQ FAILED] ${url.substring(0, 100)}: ${req.failure().errorText}`);
    }
  });

  page.on('response', res => {
    const url = res.url();
    if (url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i) || url.includes('image')) {
      console.log(`[BROWSER RES] ${res.status()} ${url.substring(0, 100)}`);
    }
  });

  console.log("Navigating to http://127.0.0.1:3000/?q=laptop");
  await page.goto('http://127.0.0.1:3000/?q=laptop', { waitUntil: 'networkidle2', timeout: 60000 });

  console.log("Waiting 60 seconds for scraping to progress and cards to render...");
  await new Promise(r => setTimeout(r, 60000));

  console.log("Inspecting DOM for product cards and img tags...");
  const cardsInfo = await page.evaluate(() => {
    const cards = document.querySelectorAll('.products-grid > div');
    const info = [];
    cards.forEach((card, idx) => {
      const titleEl = card.querySelector('h3') || card.querySelector('div[style*="font-weight"]');
      const img = card.querySelector('img');
      const svg = card.querySelector('svg');
      const skeleton = card.querySelector('.skeleton');
      
      info.push({
        index: idx,
        title: titleEl ? titleEl.innerText : 'Unknown',
        hasImg: !!img,
        imgSrc: img ? img.src : null,
        imgOpacity: img ? img.style.opacity : null,
        imgDisplay: img ? img.style.display : null,
        hasSvgPlaceholder: !!svg,
        hasSkeleton: !!skeleton
      });
    });
    return info;
  });

  console.log("--- RENDERED CARDS INFO ---");
  console.log(JSON.stringify(cardsInfo.slice(0, 10), null, 2));

  await browser.close();
}

run().catch(console.error);
