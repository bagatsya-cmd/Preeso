const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const browserManager = require('../src/utils/browserManager');
const ScrapedProduct = require('../src/models/scrapedProduct');

// Custom headers and configuration for each retailer to bypass anti-bot systems
const HEADERS = {
  ajio: {
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-site': 'none',
    'sec-fetch-mode': 'navigate',
  },
  nykaa: {
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  },
  reliance: {
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function extractPdpPrice(page, url, source) {
  try {
    // Apply headers if specific to source
    if (HEADERS[source]) {
      await page.setExtraHTTPHeaders(HEADERS[source]);
    }
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    // Navigate to page
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000)); // Wait for page hydration and dynamic renders

    const pageTitle = await page.title();
    
    // Check for access denied or captcha page
    if (pageTitle.includes('Access Denied') || pageTitle.includes('Forbidden') || pageTitle.includes('Security Check') || pageTitle.includes('Robot Check')) {
      return { error: 'BLOCKED: ' + pageTitle };
    }

    const priceInfo = await page.evaluate((src) => {
      let sellingPrice = null;
      let mrp = null;

      // 1. Try JSON-LD extraction
      const jsonLdElements = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const el of jsonLdElements) {
        try {
          const data = JSON.parse(el.textContent.trim());
          const checkObj = (obj) => {
            if (!obj) return null;
            
            // Check standard Product schema
            if (obj['@type'] === 'Product' || obj['@type'] === 'http://schema.org/Product' || obj['name']) {
              if (obj.offers) {
                let priceVal = null;
                let mrpVal = null;
                
                if (Array.isArray(obj.offers)) {
                  priceVal = obj.offers[0].price;
                  mrpVal = obj.offers[0].priceSpecification?.price || obj.offers[0].highPrice;
                } else {
                  priceVal = obj.offers.price || (obj.offers.offers && obj.offers.offers[0] && obj.offers.offers[0].price);
                  mrpVal = obj.offers.priceSpecification?.price || obj.offers.highPrice || (obj.offers.offers && obj.offers.offers[0] && obj.offers.offers[0].priceSpecification?.price);
                }
                
                if (priceVal) {
                  const p = parseFloat(String(priceVal).replace(/[^\d.]/g, ''));
                  const m = mrpVal ? parseFloat(String(mrpVal).replace(/[^\d.]/g, '')) : null;
                  return { price: p, mrp: m };
                }
              }
            }
            
            // Check graph
            if (obj['@graph']) {
              for (const item of obj['@graph']) {
                const res = checkObj(item);
                if (res) return res;
              }
            }
            
            // Check array
            if (Array.isArray(obj)) {
              for (const item of obj) {
                const res = checkObj(item);
                if (res) return res;
              }
            }
            return null;
          };
          const res = checkObj(data);
          if (res && res.price) {
            sellingPrice = res.price;
            mrp = res.mrp;
            break;
          }
        } catch (e) {}
      }

      // 2. Try meta tags if JSON-LD price not found
      if (!sellingPrice) {
        const metaPrice = document.querySelector('meta[property="product:price:amount"]') ||
                          document.querySelector('meta[property="og:price:amount"]') ||
                          document.querySelector('meta[itemprop="price"]');
        if (metaPrice) {
          const content = metaPrice.getAttribute('content') || metaPrice.getAttribute('value');
          if (content) sellingPrice = parseFloat(content.replace(/[^\d.]/g, ''));
        }
      }

      // 3. Retailer specific DOM element extractors
      if (src === 'nykaa') {
        const pEl = document.querySelector('.css-11177mr') || document.querySelector('.css-tb967g');
        if (pEl) sellingPrice = sellingPrice || parseFloat(pEl.textContent.replace(/[^\d.]/g, ''));
        
        const mEl = document.querySelector('.css-172510u') || document.querySelector('.css-91r01s');
        if (mEl) mrp = mrp || parseFloat(mEl.textContent.replace(/[^\d.]/g, ''));
      }
      
      if (src === 'flipkart') {
        const pEl = document.querySelector('.Nx9bqj._11bCQA') || document.querySelector('.Nx9bqj') || document.querySelector('._30jeq3._16Jk6d');
        if (pEl) sellingPrice = sellingPrice || parseFloat(pEl.textContent.replace(/[^\d.]/g, ''));
        
        const mEl = document.querySelector('.yRaY8j.A5052e') || document.querySelector('.yRaY8j') || document.querySelector('._3I9_wc._2p63h2');
        if (mEl) mrp = mrp || parseFloat(mEl.textContent.replace(/[^\d.]/g, ''));
      }

      if (src === 'myntra') {
        const pEl = document.querySelector('span.pdp-price strong') || document.querySelector('.pdp-price');
        if (pEl) sellingPrice = sellingPrice || parseFloat(pEl.textContent.replace(/[^\d.]/g, ''));
        
        const mEl = document.querySelector('span.pdp-mrp') || document.querySelector('.pdp-mrp');
        if (mEl) mrp = mrp || parseFloat(mEl.textContent.replace(/[^\d.]/g, ''));
      }

      if (src === 'ajio') {
        const pEl = document.querySelector('.prod-sp') || document.querySelector('.price-info .prod-sp');
        if (pEl) sellingPrice = sellingPrice || parseFloat(pEl.textContent.replace(/[^\d.]/g, ''));
        
        const mEl = document.querySelector('.prod-cp') || document.querySelector('.price-info .prod-cp');
        if (mEl) mrp = mrp || parseFloat(mEl.textContent.replace(/[^\d.]/g, ''));
      }

      if (src === 'reliance') {
        const pEl = document.querySelector('span.pdp__price') || document.querySelector('.pdp__price');
        if (pEl) sellingPrice = sellingPrice || parseFloat(pEl.textContent.replace(/[^\d.]/g, ''));
        
        const mEl = document.querySelector('span.pdp__mrp') || document.querySelector('.pdp__mrp') || document.querySelector('.mrpPrice');
        if (mEl) mrp = mrp || parseFloat(mEl.textContent.replace(/[^\d.]/g, ''));
      }

      // If price is still not found, check itemprop
      if (!sellingPrice) {
        const itemPrice = document.querySelector('[itemprop="price"]');
        if (itemPrice) {
          const content = itemPrice.getAttribute('content') || itemPrice.textContent;
          if (content) sellingPrice = parseFloat(content.replace(/[^\d.]/g, ''));
        }
      }

      return { sellingPrice, mrp };
    }, source);

    return {
      title: pageTitle,
      sellingPrice: priceInfo.sellingPrice,
      mrp: priceInfo.mrp || priceInfo.sellingPrice,
      url: page.url()
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const sources = ['nykaa', 'flipkart', 'myntra', 'ajio', 'reliance', 'amazon'];
  const results = {};

  // For Reliance, check if URL has /p/ and fails. If so, let's try replacing /p/ with /product/ as fallback.
  const adjustUrl = (url, source) => {
    if (source === 'reliance' && url.includes('/p/')) {
      // The DOM scraper stores /p/, but sometimes product redirects or works on /product/
      // Let's keep it as is first, but if it redirects, we'll try /product/
      return url;
    }
    return url;
  };

  const browser = await browserManager.getBrowser();
  
  // We will run with concurrency of 1 page at a time to be stealthy and avoid crashes, or 2 pages.
  // Let's use 2 isolated pages to speed it up.
  const page1 = await browserManager.getPage(null, true);
  const page2 = await browserManager.getPage(null, true);
  const pages = [page1, page2];

  for (const source of sources) {
    console.log(`\nGathering 20 samples for: ${source}`);
    const docs = await ScrapedProduct.find({ source }).limit(20).lean();
    results[source] = [];

    let activeProcesses = 0;
    const queue = [...docs];

    const processItem = async (doc, pageInstance) => {
      const adjustedUrl = adjustUrl(doc.url, source);
      console.log(`Processing [${source}] "${doc.title.substring(0, 30)}..."`);
      
      let details = await extractPdpPrice(pageInstance, adjustedUrl, source);
      
      // Reliance fallback: if got home page or empty and URL has /p/, try replacing with /product/
      if (source === 'reliance' && (!details.sellingPrice || details.error) && adjustedUrl.includes('/p/')) {
        const fbUrl = adjustedUrl.replace('/p/', '/product/');
        console.log(`Reliance PDP empty or failed. Trying fallback URL: ${fbUrl}`);
        details = await extractPdpPrice(pageInstance, fbUrl, source);
      }

      const scrapedPrice = doc.price;
      const livePrice = details.sellingPrice;
      const mrpPrice = details.mrp;
      
      let status = 'MATCH';
      let reason = 'Live price matches scraped price';

      if (details.error) {
        status = 'ERROR';
        reason = details.error;
      } else if (!livePrice) {
        status = 'UNKNOWN';
        reason = 'Could not parse price from PDP';
      } else if (Math.abs(scrapedPrice - livePrice) > 1) { // allow small float diff
        // It's a mismatch
        status = 'MISMATCH';
        if (mrpPrice && Math.abs(scrapedPrice - mrpPrice) <= 1 && livePrice !== mrpPrice) {
          status = 'MRP_MISMATCH';
          reason = `Scraped price matches MRP (${mrpPrice}) instead of Selling Price (${livePrice})`;
        } else {
          reason = `Scraped price: ${scrapedPrice}, Live price: ${livePrice}`;
        }
      }

      results[source].push({
        title: doc.title,
        url: adjustedUrl,
        scrapedPrice,
        livePrice: livePrice || 'N/A',
        mrp: mrpPrice || 'N/A',
        status,
        reason
      });
    };

    // Process queue with concurrency of 2
    const promises = [];
    for (let i = 0; i < pages.length; i++) {
      const runner = async (pageInstance) => {
        while (queue.length > 0) {
          const item = queue.shift();
          await processItem(item, pageInstance);
        }
      };
      promises.push(runner(pages[i]));
    }
    await Promise.all(promises);
  }

  // Close browser and DB
  await browserManager.releasePage(page1);
  await browserManager.releasePage(page2);
  await browserManager.closeBrowser();
  await mongoose.disconnect();

  console.log('\n=========================================');
  console.log('COMPILING PRICE COMPARISON REPORT');
  console.log('=========================================');

  // Let's dump results to a JSON file first to keep a backup
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'price-comparison-results.json'), JSON.stringify(results, null, 2));
  console.log('Saved raw results to price-comparison-results.json');

  // Generate statistics
  let statsSummary = '';
  for (const source of sources) {
    const list = results[source];
    const total = list.length;
    const errors = list.filter(r => r.status === 'ERROR').length;
    const valid = total - errors;
    const matches = list.filter(r => r.status === 'MATCH').length;
    const mismatches = list.filter(r => r.status === 'MISMATCH' || r.status === 'MRP_MISMATCH').length;
    const mrpMismatches = list.filter(r => r.status === 'MRP_MISMATCH').length;
    
    const mismatchPercent = valid > 0 ? ((mismatches / valid) * 100).toFixed(1) : 'N/A';
    const mrpPercent = mismatches > 0 ? ((mrpMismatches / mismatches) * 100).toFixed(1) : '0';

    statsSummary += `Retailer: ${source.toUpperCase()}\n`;
    statsSummary += `  Total samples: ${total}\n`;
    statsSummary += `  Blocked/Errors: ${errors}\n`;
    statsSummary += `  Valid comparisons: ${valid}\n`;
    statsSummary += `  Matches: ${matches}\n`;
    statsSummary += `  Mismatches: ${mismatches} (${mismatchPercent}% of valid)\n`;
    statsSummary += `    - Out of mismatches, ${mrpMismatches} (${mrpPercent}%) were because scraped price matched MRP instead of discounted price.\n\n`;
  }

  console.log(statsSummary);
}

run().catch(console.error);
