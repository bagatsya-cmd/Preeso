/**
 * AJIO Scraper — v4 (precise selectors from live DOM audit)
 *
 * Confirmed DOM structure (from ajio-debug.html):
 *   Card:   .rilrtl-products-list__item
 *   Link:   a.rilrtl-products-list__link[href]
 *   Brand:  .brand strong
 *   Name:   .nameCls
 *   Price:  span.price strong  (discounted)
 *   MRP:    .orginal-price     (note: AJIO typo - single 'i')
 *   Img:    img.rilrtl-lazy-img
 */

const fs             = require('fs');
const path           = require('path');
const browserManager = require('../utils/browserManager');
const imageValidator = require('../utils/imageValidator');
const logger         = require('../utils/logger');
const scrapeQueue    = require('../utils/scrapeQueue');

const PLATFORM   = 'AJIO';
const TIMEOUT_MS = 18000;
const DEBUG_DIR  = path.join(__dirname, '../../../../');

class AjioScraper {
  constructor() {
    this.platformName = PLATFORM;
    this.timeoutMs    = TIMEOUT_MS;
  }

  async search(query) {
    const url   = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
    let   page  = null;
    const results = [];
    const start   = Date.now();

    console.log(`[AJIO] Search: "${query}" | ${url}`);

    try {
      return await scrapeQueue.add(async () => {
        page = await browserManager.getPage(null);

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

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs })
        .catch(e => console.log(`[AJIO] goto warning: ${e.message}`));

      console.log(`[AJIO] Loaded: ${page.url()}`);

      // Human-like scroll to trigger all lazy-loaded images
      await page.waitForTimeout(500);
      await page.mouse.move(300, 400);
      await page.mouse.wheel({ deltaY: 500 });
      await page.waitForTimeout(500);

      // Confirmed selector from live DOM audit
      await page.waitForSelector('.rilrtl-products-list__item', { timeout: 8000 })
        .catch(() => console.log('[AJIO] Card selector wait timed out — trying anyway'));

      const rawProducts = await page.evaluate(() => {
        const items = [];
        const cards = Array.from(document.querySelectorAll('.rilrtl-products-list__item'));
        console.log('[AJIO-eval] Cards found:', cards.length);

        for (const card of cards.slice(0, 12)) {
          try {
            // ── Link ──────────────────────────────────────────────────────────
            const linkEl = card.querySelector('a.rilrtl-products-list__link[href]') ||
                           card.querySelector('a[href]');
            if (!linkEl) continue;
            let link = linkEl.getAttribute('href') || '';
            if (!link || link === '#') continue;
            if (link.startsWith('/')) link = 'https://www.ajio.com' + link;

            // ── Brand + Name → full title ─────────────────────────────────────
            const brandEl = card.querySelector('.brand strong, .brand');
            const nameEl  = card.querySelector('.nameCls');
            const brand   = brandEl ? brandEl.textContent.trim() : '';
            const name    = nameEl  ? nameEl.textContent.trim()  : '';

            let title = '';
            if (brand && name) {
              title = `${brand} ${name}`;
            } else if (name) {
              title = name;
            } else if (brand) {
              title = brand;
            } else {
              // Last resort: aria-label on the link
              const aria = linkEl.getAttribute('aria-label') || '';
              // aria-label format: "Brand Product Name. \n Current price; ..."
              title = aria.split('.')[0].trim();
            }

            if (!title || title.length < 3) continue;

            // ── Discounted price ───────────────────────────────────────────────
            const priceEl = card.querySelector('span.price strong, .price strong');
            let price = null;
            if (priceEl) {
              price = parseFloat(priceEl.textContent.replace(/[^\d.]/g, ''));
            }
            // Fallback: use aria-label price
            if (!price || isNaN(price)) {
              const aria = linkEl.getAttribute('aria-label') || '';
              const m    = aria.match(/Current price[^₹]*₹[,\s]*([\d,]+)/);
              if (m) price = parseFloat(m[1].replace(/,/g, ''));
            }
            // Fallback: any rupee amount in card text
            if (!price || isNaN(price)) {
              const m = (card.innerText || '').match(/₹\s*([\d,]+)/);
              if (m) price = parseFloat(m[1].replace(/,/g, ''));
            }
            if (!price || isNaN(price) || price <= 0) continue;

            // ── Original price (MRP) ───────────────────────────────────────────
            // AJIO uses .orginal-price (one 'i' — their typo)
            const mrpEl = card.querySelector('.orginal-price, .original-price, .offer-price .orginal-price');
            let originalPrice = price;
            if (mrpEl) {
              const mrp = parseFloat(mrpEl.textContent.replace(/[^\d.]/g, ''));
              if (mrp > price) originalPrice = mrp;
            }

            // ── Image ──────────────────────────────────────────────────────────
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

        console.log('[AJIO-eval] Extracted:', items.length);
        return items;
      });

      const elapsed = Date.now() - start;
      console.log(`[AJIO] ✅ ${rawProducts.length} products | ${elapsed}ms`);
      rawProducts.slice(0, 3).forEach((p, i) =>
        console.log(`[AJIO]   [${i+1}] "${p.title}" ₹${p.price}`)
      );

      logger.scraper.success(PLATFORM, rawProducts.length, elapsed);

      for (const p of rawProducts) {
        const validatedImg = imageValidator.validateImage(p.image);
        results.push({
          title:         p.title,
          price:         p.price,
          originalPrice: p.originalPrice || p.price,
          link:          p.link,
          image:         validatedImg || p.image || null,
          brand:         p.brand || 'Unknown',
          platform:      PLATFORM,
          inStock:       true,
        });
      }

      console.log(`[AJIO] Returning ${results.length} products`);
      return results;

      });
    } catch (err) {
      console.error(`[AJIO] Fatal: ${err.message}`);
      logger.scraper.fail(PLATFORM, err.message, Date.now() - start);
      return [];
    } finally {
      try {
        if (page && !page.isClosed()) {
          await page.close();
        }
      } catch (_) {}
    }
  }
}

module.exports = new AjioScraper();
