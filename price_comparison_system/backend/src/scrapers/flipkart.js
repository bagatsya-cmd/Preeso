const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');
const { extractImageInBrowser, logImageExtraction } = require('../utils/imageExtractor');

class FlipkartScraper extends BaseScraper {
  constructor() {
    super('Flipkart');
    this.containerSelector = 'div[data-id]';
    this.waitUntil = 'domcontentloaded';
  }

  async preparePage(page) {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1440, height: 900 });
  }

  async search(query, jobId = null) {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
    
    return this.scrapeWithRetry(url, async (page) => {
      const results = [];
      
      // Wait for products to load
      await page.waitForSelector(this.containerSelector, { timeout: 15000 }).catch(() => {
        console.log('[Flipkart] product container selector wait timed out');
      });

      // Deep scroll to trigger lazy loading of all product images
      await page.evaluate(async () => {
        for (let i = 0; i < 12; i++) {
          window.scrollBy(0, 600);
          await new Promise(r => setTimeout(r, 500));
        }
        // Scroll back to top slowly to re-trigger any viewport-based lazy loaders
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 1500));
      });

      // Wait for network to settle after scrolling
      try {
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
      } catch (_) {}

      // Wait for at least one non-placeholder product image to load
      await page.waitForFunction(() => {
        const images = Array.from(document.querySelectorAll('div[data-id] img'));
        return images.some(img => {
          const src = img.src || '';
          return src.startsWith('http') && 
                 (src.includes('rukminim') || src.includes('rukmini') || src.includes('/image/'));
        });
      }, { timeout: 10000 }).catch(async () => {
        console.log('[Flipkart] Wait for non-placeholder image timed out');
        const imgDetails = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('div[data-id] img'));
          return imgs.map(img => ({ src: img.src, class: img.className }));
        });
        console.log('[Flipkart DIAGNOSTIC IMAGES]:', JSON.stringify(imgDetails.slice(0, 10), null, 2));
      });

      let rawProducts = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        rawProducts = await page.evaluate((selector, extractImgFn) => {
          const elements = Array.from(document.querySelectorAll(selector));
          const items = [];
          const extractImg = new Function('return ' + extractImgFn)();
          
          for (const element of elements.slice(0, 12)) {
            try {
              // Brand
              const brandEl = element.querySelector('div.Fo1I0b, div._2WkVRV, div.hGSR34');
              const brand = brandEl ? brandEl.innerText.trim() : '';

              // Title — try specific anchors first, then img alt, then fallback text
              let title = null;
              const linkEl = element.querySelector('a.atJtCj, a.CGtC98, a._1fQZEK, a.IRpwTa, a.WKTcLC, a._2mylwZ, a._2Uzu5x');
              if (linkEl) {
                title = linkEl.getAttribute('title') || linkEl.innerText.trim();
              }
              if (!title || title.trim().length < 5) {
                const imgForAlt = element.querySelector('img.MZeksS, img._396cs4, img.DByuf4, img.CXW8mj, img');
                title = imgForAlt ? imgForAlt.getAttribute('alt') : null;
              }
              if (!title || title.trim().length < 5) {
                const firstA = element.querySelector('a');
                if (firstA && firstA.innerText.length > 5) title = firstA.innerText.trim();
              }
              if (!title) continue;

              // Prepend brand if title doesn't start with it
              if (brand && !title.toLowerCase().startsWith(brand.toLowerCase())) {
                title = `${brand} ${title}`;
              }

              // Price
              const priceEl = element.querySelector('div.hZ3P6w, div._30jeq3, div.Nx9bqj, div._1vC4OI');
              let priceText = priceEl ? priceEl.innerText : null;
              if (!priceText) {
                const m = element.innerText.match(/₹([\d,]+)/);
                if (m) priceText = m[1];
              }
              if (!priceText) continue;
              const price = parseFloat(priceText.replace(/₹|,/g, '').trim());
              if (isNaN(price)) continue;

              // Original price
              const origEl = element.querySelector('div.kRYCnD, div._3I9_wc, div.yRaY8j, div._3etB12');
              let originalPrice = price;
              if (origEl) {
                const orig = parseFloat(origEl.innerText.replace(/₹|,/g, '').trim());
                if (!isNaN(orig)) originalPrice = orig;
              }

               // Image extraction
               const imgResult = extractImg(element, 'Flipkart', window.location.href);
               const image = imgResult.image;
               const sourceAttr = imgResult.sourceAttr;
               const candidates = imgResult.candidates;
 
               // Link
               const mainLinkEl = element.querySelector('a');
               let link = mainLinkEl ? mainLinkEl.getAttribute('href') : '';
               if (!link || link === 'about:blank' || link.includes('javascript:')) continue;
               if (link.startsWith('/')) link = 'https://www.flipkart.com' + link;
 
               items.push({
                 platform: 'Flipkart', title, price, originalPrice, link,
                 image, sourceAttr, candidates,
                 imageCandidates: candidates || [],
                 brand: brand || 'Unknown', inStock: true
               });
             } catch (_) {}
           }
           return items;
         }, this.containerSelector, extractImageInBrowser.toString());
 
         if (rawProducts.length > 0) {
           break;
         }
 
         if (attempt < 3) {
           console.log(`[Flipkart] Extraction attempt ${attempt} returned 0 items. Waiting 1s...`);
           await new Promise(r => setTimeout(r, 1000));
         }
       }

      // Image recovery: re-attempt extraction for products missing images
      for (let i = 0; i < rawProducts.length; i++) {
        const p = rawProducts[i];
        if (p && p.title && p.price && !p.image) {
          console.log(`[Flipkart] Image recovery: "${p.title.substring(0, 40)}..." — waiting 2s and re-extracting`);
          await new Promise(r => setTimeout(r, 2000));
          
          // Scroll to the card area and re-extract
          const recovered = await page.evaluate((selector, idx, extractImgFn) => {
            const elements = Array.from(document.querySelectorAll(selector));
            const el = elements[idx];
            if (!el) return null;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const extractImg = new Function('return ' + extractImgFn)();
            const result = extractImg(el, 'Flipkart', window.location.href);
            return result;
          }, this.containerSelector, i, extractImageInBrowser.toString());

          if (recovered && recovered.image) {
            console.log(`[Flipkart] Image recovery SUCCESS: ${recovered.image.substring(0, 80)}`);
            rawProducts[i].image = recovered.image;
            rawProducts[i].sourceAttr = recovered.sourceAttr;
            rawProducts[i].candidates = recovered.candidates;
            rawProducts[i].imageCandidates = recovered.candidates || [];
          } else {
            console.log(`[Flipkart] Image recovery FAILED for: "${p.title.substring(0, 40)}..."`);
          }
        }
      }
 
       for (const p of rawProducts) {
         if (p && p.link && p.link.startsWith('http')) {
           logImageExtraction('Flipkart', p.title, p.image, p.sourceAttr, p.candidates);
           results.push(p);
         }
       }

      return results;
    }, query, jobId);
  }
}

module.exports = new FlipkartScraper();
