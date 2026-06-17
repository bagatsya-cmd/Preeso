const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');

class MyntraScraper extends BaseScraper {
  constructor() {
    super('Myntra');
  }

  async search(query) {
    const url = `https://www.myntra.com/${encodeURIComponent(query).replace(/%20/g, '-')}`;
    
    return this.scrapeWithRetry(url, async (page) => {
      // 1. Try JSON extraction from window.__myx script first
      const jsonProducts = await page.evaluate(() => {
        try {
          const scripts = Array.from(document.querySelectorAll('script'));
          const myxScript = scripts.find(s => s.textContent && s.textContent.includes('window.__myx') && s.textContent.includes('searchData'));
          if (myxScript) {
            const content = myxScript.textContent;
            const startIdx = content.indexOf('window.__myx =') + 'window.__myx ='.length;
            let jsonStr = content.substring(startIdx).trim();
            if (jsonStr.endsWith(';')) jsonStr = jsonStr.substring(0, jsonStr.length - 1);
            const parsed = JSON.parse(jsonStr);
            if (parsed && parsed.searchData && parsed.searchData.results && parsed.searchData.results.products) {
              return parsed.searchData.results.products.map(p => {
                let link = p.landingPageUrl || '';
                if (link && !link.startsWith('http')) {
                  link = 'https://www.myntra.com/' + link;
                }
                const image = p.searchImage || (p.images?.[0]?.src) || p.imageUrl || '';
                return {
                  platform: 'Myntra',
                  title: p.productName || `${p.brand} ${p.additionalInfo || ''}`.trim(),
                  price: parseFloat(p.price),
                  originalPrice: parseFloat(p.mrp || p.price),
                  link,
                  image,
                  brand: p.brand || 'Unknown',
                  inStock: true
                };
              });
            }
          }
        } catch (e) {
          console.error('[Myntra-eval] JSON parse error:', e.message);
        }
        return null;
      });

      if (jsonProducts && jsonProducts.length > 0) {
        console.log(`[Myntra] Successfully extracted ${jsonProducts.length} products from window.__myx JSON`);
        return jsonProducts.slice(0, 12).map(p => {
          p.image = imageValidator.validateImage(p.image) || null;
          return p;
        });
      }

      // 2. DOM fallback
      const results = [];
      
      // Wait for products to load
      await page.waitForSelector('li.product-base', { timeout: 10000 }).catch(() => {});

      const products = await page.$$('li.product-base');
      
      for (const el of products.slice(0, 12)) {
        try {
          const data = await page.evaluate(element => {
            const brandEl = element.querySelector('.product-brand');
            const nameEl = element.querySelector('.product-product');
            const priceEl = element.querySelector('.product-discountedPrice');
            const originalPriceEl = element.querySelector('.product-strike');
            const linkEl = element.querySelector('a');
            const imgEl = element.querySelector('img');
            
            // If discounted price is missing, check standard price class
            const fallbackPriceEl = element.querySelector('.product-price');

            const brand = brandEl ? brandEl.innerText.trim() : '';
            const productName = nameEl ? nameEl.innerText.trim() : '';
            const title = `${brand} ${productName}`.trim();
            
            if (!title) return null;

            let priceText = priceEl ? priceEl.innerText : null;
            if (!priceText && fallbackPriceEl) {
              // Usually format is Rs. 1999
              priceText = fallbackPriceEl.innerText.split('Rs.')[1] || fallbackPriceEl.innerText;
            }
            if (!priceText) return null;

            const price = parseFloat(priceText.replace(/Rs\.|,/g, '').trim());
            if (isNaN(price)) return null;

            let originalPrice = price;
            if (originalPriceEl) {
               const orig = parseFloat(originalPriceEl.innerText.replace(/Rs\.|,/g, '').trim());
               if (!isNaN(orig)) originalPrice = orig;
            }

            let link = linkEl ? linkEl.getAttribute('href') : '';
            if (!link || link === 'about:blank' || link.includes('javascript:')) return null;
            
            if (link.startsWith('/')) {
              link = 'https://www.myntra.com' + link;
            } else if (!link.startsWith('http')) {
              link = 'https://www.myntra.com/' + link;
            }

            try {
              const urlObj = new URL(link);
              urlObj.search = '';
              link = urlObj.toString();
            } catch(e) {}

            // Image priority: data-src > src  (Myntra lazy-loads via data-src)
            const imageEl = element.querySelector('img.img-responsive') || imgEl;
            let image = '';
            if (imageEl) {
              const dataSrc = imageEl.getAttribute('data-src');
              const src     = imageEl.getAttribute('src');
              for (const candidate of [dataSrc, src]) {
                if (candidate && !candidate.startsWith('data:') && !candidate.includes('base64')) {
                  image = candidate;
                  break;
                }
              }
            }

            return {
              platform: 'Myntra',
              title,
              price,
              originalPrice,
              link,
              image,
              brand,
              inStock: true
            };
          }, el);

          if (data && data.link && data.link.startsWith('http')) {
            data.image = imageValidator.validateImage(data.image) || null;
            results.push(data);
          }
        } catch (err) {
          console.warn(`[Myntra] Failed to parse product element: ${err.message}`);
        }
      }
      return results;
    });
  }
}

module.exports = new MyntraScraper();
