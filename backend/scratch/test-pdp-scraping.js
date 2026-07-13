const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const browserManager = require('../src/utils/browserManager');

// Test URLs from the database inspection
const TEST_URLS = {
  nykaa: 'https://www.nykaa.com/foxtale-hula-hoop-de-tan-body-wash/p/25527489?productId=25527489&pps=1',
  flipkart: 'https://www.flipkart.com/dailyobjects-back-cover-apple-iphone-15/p/itm17e36f1eb2302?pid=ACCGTUF7XHZW8PDN',
  myntra: 'https://www.myntra.com/body-cream-and-lotion/foxtale/foxtale-hula-hoop-brightening-body-lotion-to-brighten--hydrate---200-ml/30780005/buy',
  ajio: 'https://www.ajio.com/playnxt-happy-hoops-fun--fitness/p/4911857610_multi',
  reliance: 'https://www.reliancedigital.in/p/iphone-15-silicone-mobile-case-soft-mint-ltmi93-7537083'
};

async function extractPrice(page, url, source) {
  console.log(`\nNavigating to ${source}: ${url}`);
  
  // For some websites, we need stylesheets/images if they use them for anti-bot or hydration, 
  // but let's try direct load first. Reliance and Myntra might need script execution.
  await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(err => {
    console.log(`Navigation warning: ${err.message}`);
  });
  
  await new Promise(r => setTimeout(r, 3000)); // wait for React hydration

  const title = await page.title();
  console.log(`  Page Title: "${title}"`);

  const pricingData = await page.evaluate(() => {
    const results = {};
    
    // 1. JSON-LD extraction
    const jsonLdElements = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const el of jsonLdElements) {
      try {
        const data = JSON.parse(el.textContent.trim());
        const checkObj = (obj) => {
          if (!obj) return null;
          if (obj['@type'] === 'Product' || obj['@type'] === 'http://schema.org/Product' || obj['name']) {
            if (obj.offers) {
              let priceVal = null;
              if (Array.isArray(obj.offers)) {
                priceVal = obj.offers[0].price;
              } else {
                priceVal = obj.offers.price || (obj.offers.offers && obj.offers.offers[0] && obj.offers.offers[0].price);
              }
              if (priceVal) return parseFloat(String(priceVal).replace(/[^\d.]/g, ''));
            }
          }
          if (obj['@graph']) {
            for (const item of obj['@graph']) {
              const res = checkObj(item);
              if (res) return res;
            }
          }
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const res = checkObj(item);
              if (res) return res;
            }
          }
          return null;
        };
        const res = checkObj(data);
        if (res) {
          results.jsonLd = res;
          break;
        }
      } catch (e) {}
    }

    // 2. Meta tags
    const metaPrice = document.querySelector('meta[property="product:price:amount"]') ||
                      document.querySelector('meta[property="og:price:amount"]') ||
                      document.querySelector('meta[name="twitter:data1"]') ||
                      document.querySelector('meta[itemprop="price"]');
    if (metaPrice) {
      const content = metaPrice.getAttribute('content') || metaPrice.getAttribute('value');
      if (content) {
        results.meta = parseFloat(content.replace(/[^\d.]/g, ''));
      }
    }

    // 3. Itemprop element
    const itempropPrice = document.querySelector('[itemprop="price"]');
    if (itempropPrice) {
      const content = itempropPrice.getAttribute('content') || itempropPrice.textContent;
      if (content) {
        results.itemprop = parseFloat(content.replace(/[^\d.]/g, ''));
      }
    }

    // 4. Common DOM class fallbacks
    // Nykaa
    const nykaaPriceEl = document.querySelector('.css-11177mr') || document.querySelector('.css-tb967g');
    if (nykaaPriceEl) {
      results.nykaaDom = parseFloat(nykaaPriceEl.textContent.replace(/[^\d.]/g, ''));
    }
    // Flipkart
    const flipkartPriceEl = document.querySelector('.Nx9bqj._11bCQA') || document.querySelector('.Nx9bqj') || document.querySelector('._30jeq3._16Jk6d');
    if (flipkartPriceEl) {
      results.flipkartDom = parseFloat(flipkartPriceEl.textContent.replace(/[^\d.]/g, ''));
    }
    // Myntra
    const myntraPriceEl = document.querySelector('span.pdp-price strong') || document.querySelector('.pdp-price');
    if (myntraPriceEl) {
      results.myntraDom = parseFloat(myntraPriceEl.textContent.replace(/[^\d.]/g, ''));
    }
    // AJIO
    const ajioPriceEl = document.querySelector('.prod-sp') || document.querySelector('.prod-sp strong') || document.querySelector('.price-info .prod-sp');
    if (ajioPriceEl) {
      results.ajioDom = parseFloat(ajioPriceEl.textContent.replace(/[^\d.]/g, ''));
    }
    // Reliance
    const reliancePriceEl = document.querySelector('span.pdp__price') || document.querySelector('.pdp__price');
    if (reliancePriceEl) {
      results.relianceDom = parseFloat(reliancePriceEl.textContent.replace(/[^\d.]/g, ''));
    }

    return results;
  });

  console.log(`  Extracted Pricing Data:`, pricingData);
}

async function run() {
  const page = await browserManager.getPage(null, true); // skipInterception = true
  try {
    for (const [source, url] of Object.entries(TEST_URLS)) {
      await extractPrice(page, url, source);
    }
  } finally {
    await browserManager.releasePage(page);
    await browserManager.closeBrowser();
  }
}

run().catch(console.error);
