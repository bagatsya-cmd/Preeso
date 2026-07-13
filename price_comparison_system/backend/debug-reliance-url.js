/**
 * Diagnostic script: Capture Reliance Digital API response
 * and log every URL-related field to find the correct product URL.
 * 
 * Run from: price_comparison_system/backend/
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const QUERY = 'iphone';

(async () => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[DIAG] Reliance Digital URL Diagnostic`);
  console.log(`[DIAG] Query: "${QUERY}"`);
  console.log(`${'='.repeat(70)}\n`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  let apiJson = null;

  // Intercept the raven-api response
  page.on('response', async (res) => {
    try {
      const u = res.url();
      if (u.includes('/ext/raven-api/catalog/v1.0/products') || u.includes('reliance') && u.includes('product')) {
        const json = await res.json();
        if (json && json.items) {
          apiJson = json;
          console.log(`[DIAG] Captured API response from: ${u}`);
        }
      }
    } catch (e) {}
  });

  const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(QUERY)}`;
  console.log(`[DIAG] Navigating to: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    console.log(`[DIAG] Navigation timeout (continuing): ${e.message}`);
  }

  // Wait for API response
  const start = Date.now();
  while (!apiJson && (Date.now() - start < 12000)) {
    await new Promise(r => setTimeout(r, 300));
  }

  if (!apiJson || !apiJson.items || apiJson.items.length === 0) {
    console.log('[DIAG] ❌ No API response captured or empty items array.');
    
    // Try DOM scraping as fallback
    console.log('\n[DIAG] Attempting DOM link extraction...');
    await new Promise(r => setTimeout(r, 3000));
    
    const domLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .filter(a => a.href && a.href.includes('/p/'))
        .slice(0, 5)
        .map(a => ({
          href: a.getAttribute('href'),
          fullHref: a.href,
          text: a.textContent?.trim()?.substring(0, 80),
        }));
    });
    
    console.log(`[DIAG] Found ${domLinks.length} product links in DOM:`);
    for (const link of domLinks) {
      console.log(`  href: "${link.href}"`);
      console.log(`  full: "${link.fullHref}"`);
      console.log('');
    }
    
    await browser.close();
    process.exit(1);
  }

  console.log(`\n[DIAG] Total items in API response: ${apiJson.items.length}`);
  console.log(`[DIAG] Top-level API response keys: ${Object.keys(apiJson).join(', ')}`);

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

    // Check nested objects
    for (const key of Object.keys(item)) {
      const val = item[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const subKeys = Object.keys(val);
        const urlSubKeys = subKeys.filter(k => /url|slug|link|href|path|seo/i.test(k));
        if (urlSubKeys.length > 0) {
          console.log(`\n[DIAG] item.${key} has URL-like sub-keys:`);
          for (const sk of urlSubKeys) {
            console.log(`  item.${key}.${sk}: "${val[sk]}"`);
          }
        }
      }
    }

    // Check action object specifically
    if (item.action) {
      console.log(`\n[DIAG] item.action:`, JSON.stringify(item.action, null, 2));
    }

    // Check slug and constructed URL
    if (item.slug) {
      const currentUrl = `https://www.reliancedigital.in/product/${item.slug}`;
      console.log(`\n[DIAG] slug value: "${item.slug}"`);
      console.log(`[DIAG] CURRENT scraper URL: ${currentUrl}`);
    }

    // uid / itemId / id 
    if (item.uid) console.log(`[DIAG] uid: "${item.uid}"`);
    if (item.itemId) console.log(`[DIAG] itemId: "${item.itemId}"`);
    if (item.id) console.log(`[DIAG] id: "${item.id}"`);
    if (item.productId) console.log(`[DIAG] productId: "${item.productId}"`);

    // Log FULL raw item for first one only
    if (i === 0) {
      console.log(`\n[DIAG] FULL RAW ITEM 0 (JSON):`);
      console.log(JSON.stringify(item, null, 2));
    }
  }

  // Also scrape DOM links
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[DIAG] DOM-based <a> links from product cards:`);
  console.log(`${'─'.repeat(70)}`);

  const domLinks = await page.evaluate(() => {
    const results = [];
    // Get details-container links
    const detailAnchors = Array.from(document.querySelectorAll('a.details-container'));
    for (const a of detailAnchors.slice(0, 5)) {
      results.push({ type: 'details-container', href: a.getAttribute('href'), fullHref: a.href });
    }
    // Get product-card-image links
    const imgAnchors = Array.from(document.querySelectorAll('a.product-card-image'));
    for (const a of imgAnchors.slice(0, 5)) {
      results.push({ type: 'product-card-image', href: a.getAttribute('href'), fullHref: a.href });
    }
    // Get any /p/ links
    const allAnchors = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    for (const a of allAnchors.slice(0, 5)) {
      results.push({ type: 'contains-/p/', href: a.getAttribute('href'), fullHref: a.href });
    }
    return results;
  });

  for (const link of domLinks) {
    console.log(`  [${link.type}] href="${link.href}" → full="${link.fullHref}"`);
  }

  await browser.close();
  console.log(`\n[DIAG] Done.`);
})();
