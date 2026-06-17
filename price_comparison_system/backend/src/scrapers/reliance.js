const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const imageValidator = require('../utils/imageValidator');
puppeteer.use(StealthPlugin());

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

const browserManager = require('../utils/browserManager');

class RelianceScraper {
  constructor() {
    this.platformName = 'Reliance Digital';
    this.timeoutMs = 12000; // Needs more time — it's a React SPA
  }

  async search(query) {
    const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}`;
    let page = null;
    const results = [];

    try {
      page = await browserManager.getPage(null, true);

      // getPage() already configured UA, viewport, headers and request interception

      console.log(`[Reliance Digital] Navigating to ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs }).catch(() => {
        console.log('[Reliance Digital] Navigation timeout — attempting partial scrape');
      });

      // Wait for React to render product cards
      await page.waitForSelector('a.product-card-image', { timeout: 5000 }).catch(() => {
        console.log('[Reliance Digital] product-card-image not found within 5s');
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

            const parent    = anchor.parentElement;
            const imgAnchor = parent ? parent.querySelector('a.product-card-image') : null;
            const imgEl     = imgAnchor ? imgAnchor.querySelector('img') : null;
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

      for (const p of rawProducts) {
        p.image = imageValidator.validateImage(p.image) || null;
        p.originalPrice = p.price;
        p.platform = 'Reliance Digital';
        p.inStock = true;
        results.push(p);
      }
    } catch (err) {
      console.warn(`[Reliance Digital] Error: ${err.message}`);
    } finally {
      if (page && !page.isClosed()) await page.close().catch(() => {});
    }

    console.log(`[Reliance Digital] Returning ${results.length} valid products`);
    return results;
  }
}

module.exports = new RelianceScraper();
