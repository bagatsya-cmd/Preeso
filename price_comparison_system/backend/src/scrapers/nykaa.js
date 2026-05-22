/**
 * Nykaa Scraper — v4 (precise selectors from live DOM audit)
 *
 * Confirmed DOM structure (from nykaa-debug.html):
 *   Card wrapper: div.productWrapper > div > div > div > a.css-qlopj4
 *   Product link: a[href*="/p/"][class*="css-"]  (OR a[href*="productId="])
 *   Image:        img[class*="css-"]  inside the card link
 *   Title (h2):   h2.css-xrzmfa
 *   Discounted:   span.css-111z9ua
 *   Original MRP: span.css-17x46n5 span  (contains strikethrough price)
 *
 * Nykaa often redirects search → category page. That's FINE — we scrape
 * whatever page it lands on (the products are still there).
 *
 * Domain routing:
 *   fashion queries → nykaafashion.com
 *   beauty/default  → nykaa.com
 */

const fs             = require('fs');
const path           = require('path');
const browserManager = require('../utils/browserManager');
const imageValidator = require('../utils/imageValidator');
const logger         = require('../utils/logger');
const scrapeQueue    = require('../utils/scrapeQueue');

const PLATFORM   = 'Nykaa';
const TIMEOUT_MS = 18000;
const DEBUG_DIR  = path.join(__dirname, '../../../../');

const FASHION_RE = /dress|saree|kurti|kurta|top|blouse|lehenga|dupatta|jeans|skirt|hoodie|jacket|shoes|heels|sandal|boot|sneaker|handbag|bag|wallet|ethnic|western|salwar|palazzo/i;

class NykaaScraper {
  constructor() {
    this.platformName = PLATFORM;
    this.timeoutMs    = TIMEOUT_MS;
  }

  async search(query) {
    const isFashion = FASHION_RE.test(query);
    const baseUrl   = isFashion
      ? `https://www.nykaafashion.com/search/result/?q=${encodeURIComponent(query)}`
      : `https://www.nykaa.com/search/result/?q=${encodeURIComponent(query)}&ptype=search&id=0`;

    let   page    = null;
    const results = [];
    const start   = Date.now();

    console.log(`[Nykaa] Search: "${query}" | fashion=${isFashion} | ${baseUrl}`);

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

      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs })
        .catch(e => console.log(`[Nykaa] goto warning: ${e.message}`));

      const finalUrl = page.url();
      console.log(`[Nykaa] Loaded: ${finalUrl}`);
      // Note: Nykaa often redirects to category page — that's fine, products are there

      // Human-like scroll to trigger lazy image loading
      await page.waitForTimeout(500);
      await page.mouse.move(400, 300);
      await page.mouse.wheel({ deltaY: 500 });
      await page.waitForTimeout(500);

      // Wait for product grid (confirmed: a[href*="/p/"] inside .productWrapper)
      await page.waitForSelector('.productWrapper a[href*="/p/"], a[href*="productId="]', { timeout: 8000 })
        .catch(() => console.log('[Nykaa] Product link wait timed out — trying anyway'));

      const rawProducts = await page.evaluate((isFashionQ, finalUrl) => {
        const items     = [];
        const isDomain  = finalUrl.includes('nykaafashion') ? 'fashion' : 'beauty';
        const baseDomain = isDomain === 'fashion' ? 'https://www.nykaafashion.com' : 'https://www.nykaa.com';

        // ── Primary: product links with confirmed href pattern ──────────────
        // Nykaa product URLs contain /p/ or productId= param
        const productLinks = Array.from(document.querySelectorAll(
          'a[href*="/p/"], a[href*="productId="]'
        )).filter(a => {
          const href = a.getAttribute('href') || '';
          // Must be a product page link (not brand/category nav)
          return href.includes('/p/') || href.includes('productId=');
        });

        console.log('[Nykaa-eval] Product links found:', productLinks.length);

        // Deduplicate by href to avoid counting the same card twice
        const seen = new Set();
        const uniqueLinks = productLinks.filter(a => {
          const h = a.getAttribute('href') || '';
          if (seen.has(h)) return false;
          seen.add(h);
          return true;
        });

        console.log('[Nykaa-eval] Unique product links:', uniqueLinks.length);

        for (const linkEl of uniqueLinks.slice(0, 12)) {
          try {
            let link = linkEl.getAttribute('href') || '';
            if (link.startsWith('/')) link = baseDomain + link;

            // Walk up to find the card container (usually 1-3 levels up from the <a>)
            let card = linkEl;
            for (let i = 0; i < 4; i++) {
              if (!card.parentElement) break;
              card = card.parentElement;
              // Stop at a container with enough content
              if (card.querySelectorAll('img').length > 0 && card.querySelectorAll('h2, [class*="name"]').length > 0) break;
            }

            // ── Image ──────────────────────────────────────────────────────────
            const imgEl = linkEl.querySelector('img') || card.querySelector('img');
            let image = '';
            if (imgEl) {
              const srcs = [
                imgEl.getAttribute('data-src'),
                imgEl.currentSrc,
                imgEl.getAttribute('src'),
                imgEl.getAttribute('data-lazy'),
                (imgEl.getAttribute('srcset') || '').split(' ')[0],
              ];
              image = srcs.find(s => s && !s.startsWith('data:') && s.length > 10) || '';
            }

            // ── Title ──────────────────────────────────────────────────────────
            // h2.css-xrzmfa is the confirmed product name element
            const h2El = linkEl.querySelector('h2') ||
                         card.querySelector('h2.css-xrzmfa') ||
                         card.querySelector('h2, [class*="name"]');
            let title = h2El ? h2El.textContent.trim() : '';

            // Fallback: text from the link itself
            if (!title || title.length < 3) {
              title = linkEl.textContent.trim().split('\n')[0].trim();
            }
            if (!title || title.length < 3) continue;

            // ── Prices ─────────────────────────────────────────────────────────
            // Confirmed: span.css-111z9ua = discounted price, span.css-17x46n5 span = MRP
            const allText    = (card.innerText || linkEl.innerText || '').replace(/\s+/g, ' ');
            const priceMatch = allText.match(/₹\s*([\d,]+)/);
            const price      = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
            if (!price || isNaN(price) || price <= 0) continue;

            // Try to get MRP (original price)
            const allPrices  = [...allText.matchAll(/₹\s*([\d,]+)/g)]
              .map(m => parseFloat(m[1].replace(/,/g, '')));
            const originalPrice = allPrices.length > 1
              ? Math.max(...allPrices)
              : price;

            // ── Rating ─────────────────────────────────────────────────────────
            const ratingMatch = allText.match(/([1-5]\.\d)/);
            const rating      = ratingMatch ? parseFloat(ratingMatch[1]) : null;

            items.push({ title, price, originalPrice, link, image, rating });
          } catch (_) {}
        }

        console.log('[Nykaa-eval] Extracted:', items.length);
        return items;
      }, isFashion, finalUrl);

      const elapsed = Date.now() - start;
      console.log(`[Nykaa] ✅ ${rawProducts.length} products | ${elapsed}ms`);
      rawProducts.slice(0, 3).forEach((p, i) =>
        console.log(`[Nykaa]   [${i+1}] "${p.title}" ₹${p.price}`)
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
          rating:        p.rating || null,
          brand:         'Unknown',
          platform:      PLATFORM,
          inStock:       true,
        });
      }

      console.log(`[Nykaa] Returning ${results.length} products`);
      return results;

      });
    } catch (err) {
      console.error(`[Nykaa] Fatal: ${err.message}`);
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

module.exports = new NykaaScraper();
