const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');
const { extractImageInBrowser, logImageExtraction } = require('../utils/imageExtractor');

class NykaaScraper extends BaseScraper {
  constructor() {
    super('Nykaa');
    this.containerSelector = '.productWrapper a[href*="/p/"], a[href*="productId="], [data-test-id="product-card"] a, [class*="productWrapper"] a';
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
    const url = `https://www.nykaa.com/search/result/?q=${encodeURIComponent(query)}&ptype=search&id=0`;

    return this.scrapeWithRetry(url, async (page) => {
      const results = [];

      // Wait for product grid
      await page.waitForSelector(this.containerSelector, { timeout: 10000 }).catch(() => {
        console.log('[Nykaa] Product link selector wait timed out');
      });

      // Scroll to trigger lazy image loading
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

      const finalUrl = page.url();
      const pageTitle = await page.title();

      // Check for WAF block
      const isWafBlocked = pageTitle.includes('Access Denied') || pageTitle.includes('403 Forbidden');
      console.log(`[Nykaa] Final URL: ${finalUrl}`);
      console.log(`[Nykaa] Page Title: "${pageTitle}"`);
      console.log(`[Nykaa] WAF Block Status: ${isWafBlocked ? 'BLOCKED' : 'NOT_BLOCKED'}`);

      if (isWafBlocked) {
        throw new Error('WAF block page detected on Nykaa');
      }

      // Try initial state JSON parsing
      const jsonState = await page.evaluate(() => {
        if (window.__INITIAL_STATE__) {
          return window.__INITIAL_STATE__;
        }
        return null;
      });

      console.log(`[Nykaa] JSON State __INITIAL_STATE__ present: ${!!jsonState}`);

      let rawProducts = [];

      // Fallback to DOM parsing
      if (rawProducts.length === 0) {
        console.log('[Nykaa] Extracting products using DOM parser.');
        rawProducts = await page.evaluate((finalUrl, extractImgFn) => {
          const items = [];
          const isDomain = finalUrl.includes('nykaafashion') ? 'fashion' : 'beauty';
          const baseDomain = isDomain === 'fashion' ? 'https://www.nykaafashion.com' : 'https://www.nykaa.com';
          const extractImg = new Function('return ' + extractImgFn)();

          const productLinks = Array.from(document.querySelectorAll(
            'a[href*="/p/"], a[href*="productId="], [data-test-id="product-card"] a, [class*="productWrapper"] a'
          )).filter(a => {
            const href = a.getAttribute('href') || '';
            return href.includes('/p/') || href.includes('productId=');
          });

          // Deduplicate by href
          const seen = new Set();
          const uniqueLinks = productLinks.filter(a => {
            const h = a.getAttribute('href') || '';
            if (seen.has(h)) return false;
            seen.add(h);
            return true;
          });

          for (const linkEl of uniqueLinks.slice(0, 12)) {
            try {
              let link = linkEl.getAttribute('href') || '';
              if (link.startsWith('/')) link = baseDomain + link;

              // Walk up to find the card container (usually 1-3 levels up)
              let card = linkEl;
              for (let i = 0; i < 4; i++) {
                if (!card.parentElement) break;
                card = card.parentElement;
                if (card.querySelectorAll('img').length > 0 && card.querySelectorAll('h2, [class*="name"]').length > 0) break;
              }

              // Image extraction with fallbacks
              const imgResult = extractImg(card, 'Nykaa', window.location.href);
              const image = imgResult.image;
              const sourceAttr = imgResult.sourceAttr;

              // Title extraction with fallbacks
              const h2El = linkEl.querySelector('h2') ||
                           card.querySelector('h2.css-xrzmfa') ||
                           card.querySelector('h2, [class*="name"], [class*="title"]');
              let title = h2El ? h2El.textContent.trim() : '';

              if (!title || title.length < 3) {
                title = linkEl.textContent.trim().split('\n')[0].trim();
              }
              if (!title || title.length < 3) continue;

              // Prices extraction with fallbacks
              const allText = (card.innerText || linkEl.innerText || '').replace(/\s+/g, ' ');
              const priceMatch = allText.match(/₹\s*([\d,]+)/);
              const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
              if (!price || isNaN(price) || price <= 0) continue;

              const allPrices = [...allText.matchAll(/₹\s*([\d,]+)/g)]
                .map(m => parseFloat(m[1].replace(/,/g, '')));
              const originalPrice = allPrices.length > 1
                ? Math.max(...allPrices)
                : price;

              const ratingMatch = allText.match(/([1-5]\.\d)/);
              const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

              items.push({ title, price, originalPrice, link, image, sourceAttr, rating });
            } catch (_) {}
          }
          return items;
        }, finalUrl, extractImageInBrowser.toString());
      }

      console.log(`[Nykaa] Extracted count: ${rawProducts.length}`);

      for (const p of rawProducts) {
        logImageExtraction('Nykaa', p.title, p.image, p.sourceAttr);
        results.push({
          title:         p.title,
          price:         p.price,
          originalPrice: p.originalPrice || p.price,
          link:          p.link,
          image:         p.image || null,
          rating:        p.rating || null,
          brand:         'Unknown',
          platform:      'Nykaa',
          inStock:       true,
        });
      }

      return results;
    }, query, jobId);
  }
}

module.exports = new NykaaScraper();
