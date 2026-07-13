const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const browserManager = require('../src/utils/browserManager');
const { extractImageInBrowser } = require('../src/utils/imageExtractor');

const QUERIES = {
  flipkart: 'saree',
  myntra: 'saree',
  ajio: 'saree',
  reliance: 'iphone 15 cover',
  nykaa: 'lipstick'
};

async function auditRetailer(browser, retailer, query) {
  console.log(`\n================ AUDITING ${retailer.toUpperCase()} ================`);
  const page = await browserManager.getPage(null, false); // skipInterception = false to use project defaults
  
  // Custom prepare page logic from scrapers
  if (retailer === 'ajio' || retailer === 'nykaa') {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-site': 'none',
      'sec-fetch-mode': 'navigate',
    });
  }

  let url = '';
  let containerSelector = '';
  if (retailer === 'flipkart') {
    url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
    containerSelector = 'div[data-id]';
  } else if (retailer === 'myntra') {
    url = `https://www.myntra.com/${encodeURIComponent(query).replace(/%20/g, '-')}`;
    containerSelector = 'li.product-base';
  } else if (retailer === 'ajio') {
    url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
    containerSelector = '.rilrtl-products-list__item';
  } else if (retailer === 'reliance') {
    url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}`;
    containerSelector = 'a.details-container';
  } else if (retailer === 'nykaa') {
    url = `https://www.nykaa.com/search/result/?q=${encodeURIComponent(query)}&ptype=search&id=0`;
    containerSelector = '.productWrapper a[href*="/p/"], a[href*="productId="], [data-test-id="product-card"] a, [class*="productWrapper"] a';
  }

  try {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    
    // Scroll down to trigger lazy loading
    console.log('Scrolling to trigger lazy-load...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight || totalHeight > 2400) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await new Promise(r => setTimeout(r, 1500));

    const pageTitle = await page.title();
    console.log(`Page Title: "${pageTitle}"`);

    // Audit cards
    const auditData = await page.evaluate((sel, ret, extractImgFn) => {
      const cards = Array.from(document.querySelectorAll(sel));
      const extractImg = new Function('return ' + extractImgFn)();
      
      const results = [];
      for (const card of cards.slice(0, 10)) {
        // Run extraction
        const res = extractImg(card, ret, window.location.href);
        
        // Let's also collect raw images and their classes for debugging
        const allImgs = Array.from(card.querySelectorAll('img')).map(img => {
          const attributes = {};
          for (let i = 0; i < img.attributes.length; i++) {
            const attr = img.attributes[i];
            attributes[attr.name] = attr.value;
          }
          return {
            className: img.className,
            attributes
          };
        });

        // Try to get product title
        let title = 'Unknown';
        const titleEl = card.querySelector('h2, .product-brand, .brand, .nameCls, [class*="name"], [class*="title"]');
        if (titleEl) title = titleEl.textContent.trim();

        results.push({
          title,
          extractedImage: res.image,
          sourceAttr: res.sourceAttr,
          allImgs
        });
      }
      return { cardCount: cards.length, results };
    }, containerSelector, retailer === 'reliance' ? 'Reliance Digital' : (retailer === 'ajio' ? 'AJIO' : (retailer === 'myntra' ? 'Myntra' : (retailer === 'flipkart' ? 'Flipkart' : 'Nykaa'))), extractImageInBrowser.toString());

    console.log(`Found ${auditData.cardCount} product containers matching "${containerSelector}"`);
    console.log(`Audited first ${auditData.results.length} cards:`);
    
    let successCount = 0;
    auditData.results.forEach((r, idx) => {
      const isSuccess = !!r.extractedImage;
      if (isSuccess) successCount++;
      console.log(`  [Card ${idx + 1}] Title: "${r.title.substring(0, 40)}..."`);
      console.log(`    Success: ${isSuccess ? 'YES' : 'NO'}`);
      if (isSuccess) {
        console.log(`    Extracted Image: ${r.extractedImage} (Attr: ${r.sourceAttr})`);
      } else {
        console.log(`    Raw Images inside card:`, JSON.stringify(r.allImgs, null, 2));
      }
    });

    console.log(`Audit Summary for ${retailer.toUpperCase()}: ${successCount}/${auditData.results.length} succeeded (${((successCount/auditData.results.length)*100).toFixed(1)}%)`);

  } catch (err) {
    console.error(`Audit failed for ${retailer}: ${err.message}`);
  } finally {
    await browserManager.releasePage(page);
  }
}

async function run() {
  const browser = await browserManager.getBrowser();
  try {
    for (const [retailer, query] of Object.entries(QUERIES)) {
      await auditRetailer(browser, retailer, query);
    }
  } finally {
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
