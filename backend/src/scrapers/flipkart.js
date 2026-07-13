const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');
const { extractImageInBrowser, logImageExtraction } = require('../utils/imageExtractor');

class FlipkartScraper extends BaseScraper {
  constructor() {
    super('Flipkart');
    this.containerSelector = 'div[data-id]';
    this.skipInterception = true;
  }

  async search(query, jobId = null) {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;

    return this.scrapeWithRetry(url, async (page) => {
      const results = [];

      // Pipe browser console messages to Node terminal
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[REJECT-') || text.includes('[IMAGE-')) {
          console.log(`[BROWSER CONSOLE] ${text}`);
        }
      });

      // Wait for products to load
      await page.waitForSelector(this.containerSelector, { timeout: 10000 }).catch(() => {
        console.log('[Flipkart] product container selector wait timed out');
      });

      // ── Dynamic scrolling ─────────────────────────────────────────────────
      // Scroll until: no new cards for 3 checks, 15 s elapsed, or 500 cards
      const startTime = Date.now();
      let lastCount = 0;
      let unchangedStreak = 0;
      const maxCards = 500;
      const maxDuration = 15000;
      while (true) {
        await page.evaluate(() => { window.scrollBy(0, window.innerHeight); });
        await new Promise(r => setTimeout(r, 800));
        const currentCount = await page.$$eval(this.containerSelector, els => els.length);
        if (currentCount >= maxCards) break;
        if (Date.now() - startTime > maxDuration) break;
        if (currentCount === lastCount) {
          unchangedStreak++;
          if (unchangedStreak >= 3) break;
        } else {
          unchangedStreak = 0;
        }
        lastCount = currentCount;
      }

      // ── Trigger lazy-loaded product images ──────────────────────────────
      // Flipkart uses IntersectionObserver-based lazy loading. Product images
      // start as placeholder SVGs and get replaced with rukminim URLs when
      // scrolled into view. We need to scroll SLOWLY so the observer fires.
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 1000));

      // Scroll to each product card individually to trigger its lazy images
      const totalCards = await page.$$eval(this.containerSelector, els => els.length);
      console.log(`[Flipkart] Triggering lazy images for ${totalCards} cards...`);
      for (let i = 0; i < totalCards; i++) {
        await page.evaluate((sel, idx) => {
          const cards = document.querySelectorAll(sel);
          if (cards[idx]) cards[idx].scrollIntoView({ behavior: 'instant', block: 'center' });
        }, this.containerSelector, i);
        // Give each card time for its lazy image to load
        await new Promise(r => setTimeout(r, 200));
      }

      // Scroll back to top and give a final pause for any remaining loads
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 2000));

      // Check how many rukminim images loaded
      const loadedCount = await page.evaluate((sel) => {
        const cards = document.querySelectorAll(sel);
        let count = 0;
        for (const card of cards) {
          const imgs = card.querySelectorAll('img');
          for (const img of imgs) {
            if ((img.src || '').includes('rukminim')) { count++; break; }
          }
        }
        return count;
      }, this.containerSelector);
      console.log(`[Flipkart] Cards with rukminim images loaded: ${loadedCount}/${totalCards}`);

      // ── Extract products ──────────────────────────────────────────────────
      // CRITICAL: page.evaluate runs in BROWSER context.
      // - extractImageInBrowser is serialized via .toString() — it must be self-contained
      // - No require(), no Node.js APIs, no module-scope references inside the callback
      let rawProducts = [];
      const disableImgValidation = process.env.DISABLE_IMAGE_VALIDATION === 'true';
      for (let attempt = 1; attempt <= 3; attempt++) {
        rawProducts = await page.evaluate((selector, extractImgFn, disableValidation) => {
          const elements = Array.from(document.querySelectorAll(selector));
          const items = [];
          const extractImg = new Function('return ' + extractImgFn)();

          for (const element of elements.slice(0, 48)) {
            try {
              // Brand
              const brandEl = element.querySelector('div.Fo1I0b, div._2WkVRV, div.hGSR34');
              const brand = brandEl ? brandEl.innerText.trim() : '';

              // Title — try specific anchors first, then img alt, then fallback
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

              // Image extraction (runs entirely in browser context)
              const imgResult = extractImg(element, 'Flipkart', window.location.href, disableValidation);
              const image = imgResult.image;
              const sourceAttr = imgResult.sourceAttr;

              // Link
              const mainLinkEl = element.querySelector('a');
              let link = mainLinkEl ? mainLinkEl.getAttribute('href') : '';
              if (!link || link === 'about:blank' || link.includes('javascript:')) continue;
              if (link.startsWith('/')) link = 'https://www.flipkart.com' + link;

              items.push({
                platform: 'Flipkart', title, price, originalPrice,
                link, image, sourceAttr,
                brand: brand || 'Unknown', inStock: true
              });
            } catch (_) {}
          }
          return items;
        }, this.containerSelector, extractImageInBrowser.toString(), disableImgValidation);

        if (rawProducts.length > 0) break;

        if (attempt < 3) {
          console.log(`[Flipkart] Extraction attempt ${attempt} returned 0 items. Waiting 1s...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // ── Post-processing (Node.js context) ─────────────────────────────────
      // Validate images with imageValidator and log results
      for (const p of rawProducts) {
        if (!p || !p.link || !p.link.startsWith('http')) continue;

        // Validate image URL using Node-side imageValidator
        if (p.image) {
          if (process.env.DISABLE_IMAGE_VALIDATION === 'true') {
            console.log(`[IMAGE_EXTRACTED]\nretailer=flipkart\nproduct=${p.title}\nimage=${p.image}`);
            console.log(`[IMAGE_SAVED]\nstage=browser_extraction\nretailer=flipkart\nproduct=${p.title}\nimage=${p.image}`);
            console.log(`[IMAGE_SAVED]\nstage=scraper_post_processing\nretailer=flipkart\nproduct=${p.title}\nimage=${p.image}`);
          } else {
            const validated = imageValidator.validateImage(p.image);
            if (!validated) {
              console.log(`[IMAGE REJECTED] Flipkart | ${(p.title || '').substring(0, 40)} | URL: ${p.image}`);
              p.image = null;
            } else {
              p.image = validated;
            }
          }
        }

        // Log extraction result (Node-side)
        logImageExtraction('Flipkart', p.title, p.image, p.sourceAttr);

        results.push(p);
      }

      return results;
    }, query, jobId);
  }
}

module.exports = new FlipkartScraper();
