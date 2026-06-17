const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');

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

  async search(query) {
    const url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;

    return this.scrapeWithRetry(url, async (page) => {
      const results = [];

      // Wait for product cards to render
      await page.waitForSelector(this.containerSelector, { timeout: 10000 }).catch(() => {
        console.log('[AJIO] Product cards selector wait timed out');
      });

      // Pure DOM scroll to trigger lazy image loading (no mouse simulation)
      await page.evaluate(() => {
        window.scrollBy(0, 1200);
      });
      await new Promise(r => setTimeout(r, 800));

      const rawProducts = await page.evaluate(() => {
        const items = [];
        const cards = Array.from(document.querySelectorAll('.rilrtl-products-list__item'));

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

            const imgEl = card.querySelector('img.rilrtl-lazy-img, img');
            let image = '';
            if (imgEl) {
              const srcs = [
                imgEl.currentSrc,
                imgEl.getAttribute('src'),
                imgEl.getAttribute('data-src'),
                (imgEl.getAttribute('srcset') || '').split(' ')[0],
              ];
              image = srcs.find(s => s && !s.startsWith('data:') && !s.includes('base64') && s.length > 10) || '';
            }

            items.push({ title, price, originalPrice, link, image, brand });
          } catch (_) {}
        }
        return items;
      });

      for (const p of rawProducts) {
        const validatedImg = imageValidator.validateImage(p.image);
        results.push({
          title:         p.title,
          price:         p.price,
          originalPrice: p.originalPrice || p.price,
          link:          p.link,
          image:         validatedImg || p.image || null,
          brand:         p.brand || 'Unknown',
          platform:      'AJIO',
          inStock:       true,
        });
      }

      return results;
    }, query);
  }
}

// Singleton export
module.exports = new AjioScraper();
