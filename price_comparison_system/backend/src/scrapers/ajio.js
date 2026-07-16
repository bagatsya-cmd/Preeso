const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');
const { extractImageInBrowser, logImageExtraction } = require('../utils/imageExtractor');

class AjioScraper extends BaseScraper {
  constructor() {
    super('AJIO');
    this.containerSelector = '.rilrtl-products-list__item';
  }

  async preparePage(page) {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1440, height: 900 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-site': 'none',
      'sec-fetch-mode': 'navigate',
    });
  }

  async search(query, jobId = null) {
    const url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;

    return this.scrapeWithRetry(url, async (page) => {
      const results = [];

      // Wait for product cards to render
      await page.waitForSelector(this.containerSelector, { timeout: 15000 }).catch(() => {
        console.log('[AJIO] Product cards selector wait timed out');
      });

      // Deep scroll to trigger lazy image loading — two passes
      await page.evaluate(async () => {
        // First pass: scroll down in steps
        for (let i = 0; i < 8; i++) {
          window.scrollBy(0, 600);
          await new Promise(r => setTimeout(r, 400));
        }
        // Scroll back to top
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 1000));
        // Second pass: slower scroll to trigger any remaining lazy loaders
        for (let i = 0; i < 6; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 500));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 1000));
      });

      // Wait for network to settle after scrolling
      try {
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
      } catch (_) {}

      const rawProducts = await page.evaluate((extractImgFn) => {
        const items = [];
        const cards = Array.from(document.querySelectorAll('.rilrtl-products-list__item'));
        const extractImg = new Function('return ' + extractImgFn)();

        for (const card of cards.slice(0, 12)) {
          try {
            const linkEl = card.querySelector('a.rilrtl-products-list__link[href]') ||
                           card.querySelector('a[href]');
            if (!linkEl) continue;
            let link = linkEl.getAttribute('href') || '';
            if (!link || link === '#') continue;
            if (link.startsWith('/')) link = 'https://www.ajio.com' + link;

            const brandEl = card.querySelector('.brand strong, .brand');
            const nameEl = card.querySelector('.nameCls');
            const brand = brandEl ? brandEl.textContent.trim() : '';
            const name = nameEl ? nameEl.textContent.trim() : '';

            let title = '';
            if (brand && name) {
              title = `${brand} ${name}`;
            } else if (name) {
              title = name;
            } else if (brand) {
              title = brand;
            } else {
              const aria = linkEl.getAttribute('aria-label') || '';
              title = aria.split('.')[0].trim();
            }

            if (!title || title.length < 3) continue;

            const priceEl = card.querySelector('span.price strong, .price strong');
            let price = null;
            if (priceEl) {
              price = parseFloat(priceEl.textContent.replace(/[^\d.]/g, ''));
            }
            if (!price || isNaN(price)) {
              const aria = linkEl.getAttribute('aria-label') || '';
              const m = aria.match(/Current price[^₹]*₹[,\s]*([\d,]+)/);
              if (m) price = parseFloat(m[1].replace(/,/g, ''));
            }
            if (!price || isNaN(price)) {
              const m = (card.innerText || '').match(/₹\s*([\d,]+)/);
              if (m) price = parseFloat(m[1].replace(/,/g, ''));
            }
            if (!price || isNaN(price) || price <= 0) continue;

            const mrpEl = card.querySelector('.orginal-price, .original-price, .offer-price .orginal-price');
            let originalPrice = price;
            if (mrpEl) {
              const mrp = parseFloat(mrpEl.textContent.replace(/[^\d.]/g, ''));
              if (mrp > price) originalPrice = mrp;
            }

             // Image extraction using helper
             const imgResult = extractImg(card, 'AJIO', window.location.href);
             const image = imgResult.image;
             const sourceAttr = imgResult.sourceAttr;
             const candidates = imgResult.candidates;
 
             items.push({
               title, price, originalPrice, link, image, sourceAttr, candidates,
               imageCandidates: candidates || [],
               brand
             });
           } catch (_) {}
         }
         return items;
       }, extractImageInBrowser.toString());

      // Image recovery for products missing images
      for (let i = 0; i < rawProducts.length; i++) {
        const p = rawProducts[i];
        if (p && p.title && p.price && !p.image) {
          console.log(`[AJIO] Image recovery: "${p.title.substring(0, 40)}..." — waiting 2s and re-extracting`);
          await new Promise(r => setTimeout(r, 2000));

          const recovered = await page.evaluate((idx, extractImgFn) => {
            const cards = Array.from(document.querySelectorAll('.rilrtl-products-list__item'));
            const card = cards[idx];
            if (!card) return null;
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const extractImg = new Function('return ' + extractImgFn)();
            return extractImg(card, 'AJIO', window.location.href);
          }, i, extractImageInBrowser.toString());

          if (recovered && recovered.image) {
            console.log(`[AJIO] Image recovery SUCCESS: ${recovered.image.substring(0, 80)}`);
            rawProducts[i].image = recovered.image;
            rawProducts[i].sourceAttr = recovered.sourceAttr;
            rawProducts[i].candidates = recovered.candidates;
            rawProducts[i].imageCandidates = recovered.candidates || [];
          } else {
            console.log(`[AJIO] Image recovery FAILED for: "${p.title.substring(0, 40)}..."`);
          }
        }
      }
 
       for (const p of rawProducts) {
         logImageExtraction('AJIO', p.title, p.image, p.sourceAttr, p.candidates);
         results.push({
           title:         p.title,
           price:         p.price,
           originalPrice: p.originalPrice || p.price,
           link:          p.link,
           image:         p.image || null,
           imageCandidates: p.imageCandidates || [],
           brand:         p.brand || 'Unknown',
           platform:      'AJIO',
           inStock:       true,
         });
       }

      return results;
    }, query, jobId);
  }
}

// Singleton export
module.exports = new AjioScraper();
