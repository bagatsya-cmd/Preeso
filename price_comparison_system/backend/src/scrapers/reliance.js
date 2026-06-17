const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');

class RelianceScraper extends BaseScraper {
  constructor() {
    super('Reliance Digital');
    this.skipInterception = true;
    this.timeoutMs = 15000; // Client-side rendered React SPA needs ample time
  }

  async search(query) {
    const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}`;

    return this.scrapeWithRetry(url, async (page) => {
      // Wait for React to render product details containers
      await page.waitForSelector('a.details-container', { timeout: 10000 }).catch(() => {
        console.log('[Reliance Digital] details-container not found within 10s');
      });

      const rawProducts = await page.evaluate(() => {
        const items = [];
        const detailAnchors = Array.from(document.querySelectorAll('a.details-container'));

        for (const anchor of detailAnchors.slice(0, 12)) {
          try {
            let link = anchor.getAttribute('href') || '';
            if (!link || link === '#') continue;
            if (link.startsWith('/')) link = 'https://www.reliancedigital.in' + link;

            // Title from any first meaningful text node — skip promo/badge divs
            const divs = Array.from(anchor.querySelectorAll('div'));
            const titleEl = divs.find(d => {
              if (d.childElementCount !== 0) return false;
              const t = d.textContent.trim();
              // Must be longer than 5 chars, have lowercase letters (not all-caps badge), and not pure numbers
              return t.length > 5 && /[a-z]/.test(t);
            });
            const title = titleEl ? titleEl.textContent.trim() : anchor.textContent.trim().split('\n').find(l => l.trim().length > 5 && /[a-z]/.test(l));
            if (!title || title.length < 3) continue;

            const allText = anchor.innerText || '';
            const priceMatch = allText.match(/₹\s?[\d,]+(?:\.\d{0,2})?/);
            if (!priceMatch) continue;
            const price = parseFloat(priceMatch[0].replace(/[₹,\s]/g, ''));
            if (isNaN(price) || price <= 0) continue;

            const parent      = anchor.parentElement;
            const grandparent = parent ? parent.parentElement : null;
            const imgAnchor   = grandparent ? grandparent.querySelector('a.product-card-image') : null;
            const imgEl       = imgAnchor ? imgAnchor.querySelector('img') : null;
            let image = '';
            if (imgEl) {
              // Image priority: currentSrc > src > data-src > srcset[0]
              const srcsetFirst = (imgEl.getAttribute('srcset') || '').split(' ')[0];
              const candidates  = [
                imgEl.currentSrc,
                imgEl.getAttribute('src'),
                imgEl.getAttribute('data-src'),
                srcsetFirst,
              ];
              for (const candidate of candidates) {
                if (candidate && !candidate.startsWith('data:') && !candidate.includes('base64') && candidate.length > 10) {
                  image = candidate;
                  break;
                }
              }
            }

            items.push({ title, price, link, image });
          } catch (e) {}
        }
        return items;
      });

      console.log(`[Reliance Digital] Raw scrape returned ${rawProducts.length} items`);

      return rawProducts.map(p => ({
        ...p,
        image: imageValidator.validateImage(p.image) || null,
        originalPrice: p.price,
        platform: 'Reliance Digital',
        inStock: true
      }));
    });
  }
}

module.exports = new RelianceScraper();
