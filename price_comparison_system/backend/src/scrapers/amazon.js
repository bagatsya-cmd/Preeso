const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');

class AmazonScraper extends BaseScraper {
  constructor() {
    super('Amazon');
  }

  async search(query) {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
    
    return this.scrapeWithRetry(url, async (page) => {
      const results = [];
      
      await page.waitForSelector('.s-result-item[data-component-type="s-search-result"]', { timeout: 10000 }).catch(() => {});

      const products = await page.$$('.s-result-item[data-component-type="s-search-result"]');
      
      for (const el of products.slice(0, 12)) {
        try {
          const data = await page.evaluate(element => {
            const titleEl = element.querySelector('h2 a') || element.querySelector('h2');
            const priceEl = element.querySelector('.a-price-whole') || element.querySelector('.a-price .a-offscreen');
            const originalPriceEl = element.querySelector('.a-text-price .a-offscreen');
            const linkEl = element.querySelector('h2 a') || element.querySelector('.a-link-normal.s-no-outline');

            if (!titleEl || !priceEl || !linkEl) return null;

            const title = titleEl.textContent.trim();
            const priceText = priceEl.innerText.replace(/,/g, '').trim();
            const price = parseFloat(priceText);
            if (isNaN(price)) return null;

            let originalPrice = price;
            if (originalPriceEl) {
              const t = originalPriceEl.innerText.replace(/,/g, '').replace('₹', '').trim();
              if (t && !isNaN(parseFloat(t))) originalPrice = parseFloat(t);
            }

            let link = linkEl.getAttribute('href') || '';
            if (!link || link === 'about:blank' || link.includes('javascript:')) return null;
            if (link.startsWith('/')) link = 'https://www.amazon.in' + link;
            try { const u = new URL(link); u.search = ''; link = u.toString(); } catch (e) {}

            // Image: priority order — data-a-dynamic-image > data-old-hires > src > currentSrc
            const imgEl = element.querySelector('img.s-image')
                       || element.querySelector('img[data-image-latency]')
                       || element.querySelector('img.a-dynamic-image')
                       || element.querySelector('img');

            const imgCandidates = [];
            if (imgEl) {
              // data-a-dynamic-image: JSON map { url: [w, h] } — highest res
              const dynData = imgEl.getAttribute('data-a-dynamic-image');
              if (dynData) {
                try {
                  const keys = Object.keys(JSON.parse(dynData));
                  imgCandidates.push(...keys);
                } catch (_) {}
              }
              const oldHires = imgEl.getAttribute('data-old-hires');
              if (oldHires) imgCandidates.push(oldHires);
              const src = imgEl.getAttribute('src');
              if (src) imgCandidates.push(src);
              const currentSrc = imgEl.currentSrc;
              if (currentSrc) imgCandidates.push(currentSrc);
            }
            const image = imgCandidates.find(u => u && !u.startsWith('data:')) || '';

            return { platform: 'Amazon', title, price, originalPrice, link, image, inStock: true };
          }, el);

          if (data && data.link && data.link.startsWith('http')) {
            // Use pickBestImage to prefer the highest-quality URL from all collected candidates
            const candidates = [data.image].filter(Boolean);
            data.image = imageValidator.pickBestImage(candidates) || imageValidator.validateImage(data.image) || null;
            results.push(data);
          }
        } catch (err) {
          console.warn(`[Amazon] Failed to parse product element: ${err.message}`);
        }
      }
      return results;
    });
  }
}

module.exports = new AmazonScraper();
