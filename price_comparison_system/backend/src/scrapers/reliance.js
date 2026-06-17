const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');

class RelianceScraper extends BaseScraper {
  constructor() {
    super('Reliance Digital');
    this.skipInterception = true;
    this.timeoutMs = 15000; // Client-side rendered React SPA needs ample time
    this.containerSelector = 'a.details-container';
  }

  async preparePage(page) {
    page._apiJson = null;
    page.on('response', async (res) => {
      try {
        const u = res.url();
        if (u.includes('/ext/raven-api/catalog/v1.0/products')) {
          page._apiJson = await res.json();
          console.log(`[Reliance Digital] Successfully captured raven API response from ${u}`);
        }
      } catch (err) {
        // Response might not have json (e.g. 204 or OPTIONS requests)
      }
    });
  }

  async search(query) {
    const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}`;

    return this.scrapeWithRetry(url, async (page) => {
      // 1. Try to fetch from captured API response first, wait up to 8s
      const apiStart = Date.now();
      while (!page._apiJson && (Date.now() - apiStart < 8000)) {
        await new Promise(r => setTimeout(r, 200));
      }

      if (page._apiJson && page._apiJson.items && page._apiJson.items.length > 0) {
        console.log(`[Reliance Digital] API Interception succeeded. Parsing ${page._apiJson.items.length} items from JSON.`);
        const items = [];
        for (const item of page._apiJson.items.slice(0, 12)) {
          try {
            const title = item.name;
            const price = item.price && item.price.effective && item.price.effective.min ? item.price.effective.min : null;
            if (!title || !price) continue;

            const slug = item.slug;
            const link = slug ? `https://www.reliancedigital.in/p/${slug}` : `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}`;
            
            // Image extraction from medias
            let image = '';
            if (item.medias && item.medias.length > 0) {
              image = item.medias[0].url || '';
            }

            items.push({
              title,
              price,
              originalPrice: price,
              link,
              image: imageValidator.validateImage(image) || null,
              brand: item.brand && item.brand.name ? item.brand.name : 'Unknown',
              platform: 'Reliance Digital',
              inStock: true
            });
          } catch (err) {
            console.error('[Reliance Digital] Error parsing JSON item:', err.message);
          }
        }
        return items;
      }

      console.log('[Reliance Digital] API response not captured or empty within 8s. Falling back to DOM scraping.');

      let hydrated = false;
      // Wait for React to render product details containers
      await page.waitForSelector(this.containerSelector, { timeout: 10000 }).then(() => {
        hydrated = true;
        console.log('[Reliance Digital] React app hydrated successfully.');
      }).catch(() => {
        console.log('[Reliance Digital] details-container not found within 10s. Hydration status: failed or delayed.');
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

      console.log(`[Reliance Digital] Hydration status: ${hydrated ? 'hydrated' : 'not-hydrated'}. Raw scrape returned ${rawProducts.length} items.`);

      return rawProducts.map(p => ({
        ...p,
        image: imageValidator.validateImage(p.image) || null,
        originalPrice: p.price,
        platform: 'Reliance Digital',
        inStock: true
      }));
    }, query);
  }
}

module.exports = new RelianceScraper();
