/**
 * Diagnostic script: Capture Reliance Digital API response
 * and log every URL-related field to find the correct product URL.
 */
const puppeteer = require('puppeteer');

const QUERY = 'iphone';

(async () => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[DIAG] Reliance Digital URL Diagnostic`);
  console.log(`[DIAG] Query: "${QUERY}"`);
  console.log(`${'='.repeat(70)}\n`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  let apiJson = null;

  // Intercept the raven-api response
  page.on('response', async (res) => {
    try {
      const u = res.url();
      if (u.includes('/ext/raven-api/catalog/v1.0/products')) {
        apiJson = await res.json();
        console.log(`[DIAG] Captured API response from: ${u}`);
      }
    } catch (e) {}
  });

  const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(QUERY)}`;
  console.log(`[DIAG] Navigating to: ${url}`);
  
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  
  // Wait for API response
  const start = Date.now();
  while (!apiJson && (Date.now() - start < 10000)) {
    await new Promise(r => setTimeout(r, 200));
  }

  if (!apiJson || !apiJson.items || apiJson.items.length === 0) {
    console.log('[DIAG] ❌ No API response captured or empty items array.');
    await browser.close();
    process.exit(1);
  }

  console.log(`\n[DIAG] Total items in API response: ${apiJson.items.length}`);

  // Log ALL top-level keys of the API response
  console.log(`\n[DIAG] Top-level API response keys: ${Object.keys(apiJson).join(', ')}`);

  // Examine the first 3 items in detail
  for (let i = 0; i < Math.min(3, apiJson.items.length); i++) {
    const item = apiJson.items[i];
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`[DIAG] ITEM ${i + 1}: ${item.name || 'NO NAME'}`);
    console.log(`${'─'.repeat(70)}`);

    // Log ALL top-level keys for this item
    console.log(`[DIAG] Item keys: ${Object.keys(item).join(', ')}`);

    // Log every URL-related field we can find
    const urlFields = [
      'url', 'productUrl', 'pdpUrl', 'seoUrl', 'targetUrl',
      'canonicalUrl', 'slug', 'link', 'href', 'path',
      'webUrl', 'shareUrl', 'deepLink', 'permalink',
      'productSlug', 'seoSlug', 'urlKey', 'uri',
      'detailUrl', 'pageUrl'
    ];

    console.log(`\n[DIAG] URL-related fields:`);
    for (const field of urlFields) {
      if (item[field] !== undefined) {
        console.log(`  ${field}: "${item[field]}"`);
      }
    }

    // Also check nested objects for URL fields
    if (item.action) {
      console.log(`\n[DIAG] item.action:`, JSON.stringify(item.action, null, 2));
    }
    if (item.seo) {
      console.log(`\n[DIAG] item.seo:`, JSON.stringify(item.seo, null, 2));
    }
    if (item.brand) {
      console.log(`\n[DIAG] item.brand:`, JSON.stringify(item.brand, null, 2));
    }
    if (item.uid) {
      console.log(`[DIAG] item.uid: "${item.uid}"`);
    }
    if (item.itemId || item.id || item._id || item.productId) {
      console.log(`[DIAG] item.itemId: "${item.itemId}", item.id: "${item.id}", item.productId: "${item.productId}"`);
    }

    // Check the slug and what URL the scraper currently builds
    if (item.slug) {
      const currentUrl = `https://www.reliancedigital.in/product/${item.slug}`;
      console.log(`\n[DIAG] CURRENT scraper builds: ${currentUrl}`);
    }

    // Log the FULL raw item (first one only, to avoid spam)
    if (i === 0) {
      console.log(`\n[DIAG] FULL RAW ITEM 0 (JSON):`);
      console.log(JSON.stringify(item, null, 2));
    }
  }

  // Also scrape the DOM links to compare
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[DIAG] DOM-based <a> links from product cards:`);
  console.log(`${'─'.repeat(70)}`);

  const domLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a.details-container, a.product-card-image'));
    return anchors.slice(0, 5).map(a => ({
      href: a.getAttribute('href'),
      fullHref: a.href,
      text: a.textContent?.trim()?.substring(0, 60),
    }));
  });

  for (const link of domLinks) {
    console.log(`  href attr: "${link.href}"`);
    console.log(`  full href: "${link.fullHref}"`);
    console.log(`  text: "${link.text}"`);
    console.log('');
  }

  await browser.close();
  console.log(`\n[DIAG] Done.`);
})();
