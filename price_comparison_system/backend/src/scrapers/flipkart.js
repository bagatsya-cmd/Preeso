const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');

class FlipkartScraper extends BaseScraper {
  constructor() {
    super('Flipkart');
    this.containerSelector = 'div[data-id]';
  }

  async search(query) {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
    
    return this.scrapeWithRetry(url, async (page) => {
      const results = [];
      
      // Wait for products to load
      await page.waitForSelector(this.containerSelector, { timeout: 10000 }).catch(() => {
        console.log('[Flipkart] product container selector wait timed out');
      });

      // Scroll to trigger lazy loading of images
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 400;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight || totalHeight > 3000) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      await new Promise(r => setTimeout(r, 800));

      let rawProducts = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        rawProducts = await page.evaluate((selector) => {
          const elements = Array.from(document.querySelectorAll(selector));
          const items = [];
          
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

              // Image priority: currentSrc > data-src > src
              const imgEl = element.querySelector('img.MZeksS, img._396cs4, img.DByuf4, img.CXW8mj, img');
              let image = '';
              if (imgEl) {
                const currentSrc = imgEl.currentSrc;
                const dataSrc    = imgEl.getAttribute('data-src');
                const src        = imgEl.getAttribute('src');

                for (const candidate of [currentSrc, dataSrc, src]) {
                  if (candidate && !candidate.startsWith('data:') && !candidate.includes('base64') && !candidate.includes('placeholder')) {
                    image = candidate;
                    break;
                  }
                }
              }

              // Link
              const mainLinkEl = element.querySelector('a');
              let link = mainLinkEl ? mainLinkEl.getAttribute('href') : '';
              if (!link || link === 'about:blank' || link.includes('javascript:')) continue;
              if (link.startsWith('/')) link = 'https://www.flipkart.com' + link;

              items.push({ platform: 'Flipkart', title, price, originalPrice, link, image, brand: brand || 'Unknown', inStock: true });
            } catch (_) {}
          }
          return items;
        }, this.containerSelector);

        if (rawProducts.length > 0) {
          break;
        }

        if (attempt < 3) {
          console.log(`[Flipkart] Extraction attempt ${attempt} returned 0 items. Waiting 1s...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      for (const p of rawProducts) {
        if (p && p.link && p.link.startsWith('http')) {
          p.image = imageValidator.validateImage(p.image) || null;
          results.push(p);
        }
      }

      return results;
    }, query);
  }
}

module.exports = new FlipkartScraper();
