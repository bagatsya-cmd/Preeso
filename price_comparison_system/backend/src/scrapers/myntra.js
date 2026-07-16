const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');
const { extractImageInBrowser, logImageExtraction, cleanImageUrl, validateImageUrl } = require('../utils/imageExtractor');

class MyntraScraper extends BaseScraper {
  constructor() {
    super('Myntra');
    this.containerSelector = 'li.product-base';
  }

  async search(query, jobId = null) {
    const url = `https://www.myntra.com/${encodeURIComponent(query).replace(/%20/g, '-')}`;
    
    return this.scrapeWithRetry(url, async (page) => {
      // 1. Try JSON extraction from window.__myx script first
      const jsonResult = await page.evaluate(() => {
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
              const products = parsed.searchData.results.products.map(p => {
                let link = p.landingPageUrl || '';
                if (link && !link.startsWith('http')) {
                  link = 'https://www.myntra.com/' + link;
                }
                const image = p.searchImage || (p.images?.[0]?.src) || p.imageUrl || '';
                const imageCandidates = [];
                if (p.searchImage) imageCandidates.push({ url: p.searchImage, attr: 'json-searchImage', score: 100 });
                if (p.images?.[0]?.src && p.images[0].src !== p.searchImage) imageCandidates.push({ url: p.images[0].src, attr: 'json-images[0]', score: 90 });
                if (p.imageUrl && p.imageUrl !== p.searchImage) imageCandidates.push({ url: p.imageUrl, attr: 'json-imageUrl', score: 80 });
                return {
                  platform: 'Myntra',
                  title: p.productName || `${p.brand} ${p.additionalInfo || ''}`.trim(),
                  price: parseFloat(p.price),
                  originalPrice: parseFloat(p.mrp || p.price),
                  link,
                  image,
                  imageCandidates,
                  brand: p.brand || 'Unknown',
                  inStock: true
                };
              });
              return { success: true, products };
            }
          }
        } catch (e) {
          return { success: false, error: e.message };
        }
        return { success: false };
      });

      if (jsonResult && jsonResult.success && jsonResult.products && jsonResult.products.length > 0) {
        console.log(`[Myntra] JSON extraction success! Extracted ${jsonResult.products.length} products from window.__myx JSON`);
        return jsonResult.products.slice(0, 12).map(p => {
          const cleaned = cleanImageUrl(p.image);
          p.image = validateImageUrl(cleaned, 'https://www.myntra.com') || null;
          logImageExtraction('Myntra', p.title, p.image, p.image ? 'json' : null);
          if (!p.imageCandidates) p.imageCandidates = [];
          return p;
        });
      } else {
        console.log(`[Myntra] JSON extraction failure: ${jsonResult?.error || 'No window.__myx script containing searchData found'}`);
      }

      // 2. DOM fallback
      const results = [];
      console.log('[Myntra] Falling back to DOM selector extraction...');
      
      // Wait for products to load
      await page.waitForSelector(this.containerSelector, { timeout: 10000 }).catch(() => {
        console.log('[Myntra] DOM product base selector wait timed out');
      });

      const products = await page.$$(this.containerSelector);
      console.log(`[Myntra] DOM fallback usage. Found ${products.length} product containers.`);
      
      for (const el of products.slice(0, 12)) {
        try {
          const data = await page.evaluate((element, extractImgFn) => {
            const brandEl = element.querySelector('.product-brand');
            const nameEl = element.querySelector('.product-product');
            const priceEl = element.querySelector('.product-discountedPrice');
            const originalPriceEl = element.querySelector('.product-strike');
            const linkEl = element.querySelector('a');
            
            const extractImg = new Function('return ' + extractImgFn)();
            const fallbackPriceEl = element.querySelector('.product-price');

            const brand = brandEl ? brandEl.innerText.trim() : '';
            const productName = nameEl ? nameEl.innerText.trim() : '';
            const title = `${brand} ${productName}`.trim();
            
            if (!title) return null;

            let priceText = priceEl ? priceEl.innerText : null;
            if (!priceText && fallbackPriceEl) {
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

             // Image extraction using helper
             const imgResult = extractImg(element, 'Myntra', window.location.href);
             const image = imgResult.image;
             const sourceAttr = imgResult.sourceAttr;
             const candidates = imgResult.candidates;
 
             return {
               platform: 'Myntra',
               title,
               price,
               originalPrice,
               link,
               image,
               sourceAttr,
               candidates,
               imageCandidates: candidates || [],
               brand,
               inStock: true
             };
           }, el, extractImageInBrowser.toString());
 
           if (data && data.link && data.link.startsWith('http')) {
             logImageExtraction('Myntra', data.title, data.image, data.sourceAttr, data.candidates);
             results.push(data);
           }
        } catch (err) {
          console.warn(`[Myntra] Failed to parse product element: ${err.message}`);
        }
      }
      
      console.log(`[Myntra] DOM fallback completed. Extracted count: ${results.length}`);
      return results;
    }, query, jobId);
  }
}

module.exports = new MyntraScraper();
