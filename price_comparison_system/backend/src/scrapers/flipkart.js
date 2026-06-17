const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');

class FlipkartScraper extends BaseScraper {
  constructor() {
    super('Flipkart');
  }

  async search(query) {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
    
    return this.scrapeWithRetry(url, async (page) => {
      const results = [];
      
      await page.waitForSelector('div[data-id]', { timeout: 10000 }).catch(() => {});

      console.log(`[Flipkart] Query: ${query}`);
      console.log(`[Flipkart] Title: ${await page.title()}`);
      console.log(`[Flipkart] URL: ${page.url()}`);

      const html = await page.content();
      console.log(`[Flipkart] HTML length: ${html.length}`);

      const products = await page.$$('div[data-id]');
      console.log(`[Flipkart] Found ${products.length} product containers`);

      const products = await page.$$('div[data-id]');
      
      for (const el of products.slice(0, 12)) {
        try {
          const data = await page.evaluate(element => {
            // Title — try img alt first (most reliable on Flipkart), then anchor text
            const imgForAlt = element.querySelector('img._396cs4, img.DByuf4, img.CXW8mj, img');
            let title = imgForAlt ? imgForAlt.getAttribute('alt') : null;
            if (!title || title.trim().length < 5) {
              const linkEl = element.querySelector('a.CGtC98, a._1fQZEK, a.IRpwTa, a.WKTcLC');
              title = linkEl ? linkEl.innerText.trim() : null;
              if (!title) {
                const firstA = element.querySelector('a');
                if (firstA && firstA.innerText.length > 10) title = firstA.innerText.trim();
              }
            }
            if (!title) return null;

            // Price
            const priceEl = element.querySelector('div._30jeq3, div.Nx9bqj');
            let priceText = priceEl ? priceEl.innerText : null;
            if (!priceText) {
              const m = element.innerText.match(/₹([\d,]+)/);
              if (m) priceText = m[1];
            }
            if (!priceText) return null;
            const price = parseFloat(priceText.replace(/₹|,/g, '').trim());
            if (isNaN(price)) return null;

            // Original price
            const origEl = element.querySelector('div._3I9_wc, div.yRaY8j');
            let originalPrice = price;
            if (origEl) {
              const orig = parseFloat(origEl.innerText.replace(/₹|,/g, '').trim());
              if (!isNaN(orig)) originalPrice = orig;
            }

            // Image priority: currentSrc > data-src > src
            const imgEl = element.querySelector('img._396cs4')
                       || element.querySelector('img.DByuf4')
                       || element.querySelector('img.CXW8mj')
                       || element.querySelector('img');
            let image = '';
            if (imgEl) {
              // currentSrc is the browser-resolved URL after lazy loading
              const currentSrc = imgEl.currentSrc;
              const dataSrc    = imgEl.getAttribute('data-src');
              const src        = imgEl.getAttribute('src');

              for (const candidate of [currentSrc, dataSrc, src]) {
                if (candidate && !candidate.startsWith('data:') && !candidate.includes('base64')) {
                  image = candidate;
                  break;
                }
              }
            }

            // Link
            const linkEl = element.querySelector('a');
            let link = linkEl ? linkEl.getAttribute('href') : '';
            if (!link || link === 'about:blank' || link.includes('javascript:')) return null;
            if (link.startsWith('/')) link = 'https://www.flipkart.com' + link;

            return { platform: 'Flipkart', title, price, originalPrice, link, image, inStock: true };
          }, el);

          if (data && data.link && data.link.startsWith('http')) {
            data.image = imageValidator.validateImage(data.image) || null;
            results.push(data);
          }
        } catch (err) {
          console.warn(`[Flipkart] Failed to parse product element: ${err.message}`);
        }
      }
      return results;
    });
  }
}

module.exports = new FlipkartScraper();
