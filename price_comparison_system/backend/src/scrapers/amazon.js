const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');
const { extractImageInBrowser, logImageExtraction } = require('../utils/imageExtractor');

class AmazonScraper extends BaseScraper {
  constructor() {
    super('Amazon');
    this.containerSelector = '.s-result-item[data-component-type="s-search-result"]';
  }

  async search(query, jobId = null) {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
    
    return this.scrapeWithRetry(url, async (page) => {
      // 1. Anti-bot & CAPTCHA detection
      const pageTitle = await page.title();
      const pageContent = await page.content();
      
      if (/captcha|robot check|automated access/i.test(pageTitle) || /enter the characters you see below|robot check/i.test(pageContent)) {
        console.error(`[Amazon] CAPTCHA / Robot Check page detected! Title: "${pageTitle}"`);
        throw new Error('Bot detected (CAPTCHA/Robot Check)');
      }

      // 4. Add randomized delays (1-3 seconds)
      const randomDelay = 1000 + Math.floor(Math.random() * 2000);
      console.log(`[Amazon] Waiting for ${randomDelay}ms randomized delay...`);
      await new Promise(r => setTimeout(r, randomDelay));

      const results = [];
      
      // Wait for network to settle
      try {
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
      } catch (_) {}

      // Scroll to trigger lazy loading of images
      await page.evaluate(async () => {
        for (let i = 0; i < 4; i++) {
          window.scrollBy(0, 800);
          await new Promise(r => setTimeout(r, 400));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 1000));
      });

      // Wait for network to settle after scrolling
      try {
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
      } catch (_) {}

      const products = await page.$$(this.containerSelector);
      
      for (const el of products.slice(0, 12)) {
        try {
          const data = await page.evaluate((element, extractImgFn) => {
            const titleEl = element.querySelector('h2 a') || element.querySelector('h2') || element.querySelector('span.a-size-medium') || element.querySelector('span.a-size-base-plus');
            const priceEl = element.querySelector('.a-price-whole') || element.querySelector('.a-price .a-offscreen') || element.querySelector('span.a-price');
            const originalPriceEl = element.querySelector('.a-text-price .a-offscreen') || element.querySelector('span.a-text-price');
            const linkEl = element.querySelector('h2 a') || element.querySelector('.a-link-normal.s-no-outline') || element.querySelector('a.a-link-normal');
            
            const extractImg = new Function('return ' + extractImgFn)();

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

             // Image extraction using helper
             const imgResult = extractImg(element, 'Amazon', window.location.href);
             const image = imgResult.image;
             const sourceAttr = imgResult.sourceAttr;
             const candidates = imgResult.candidates;
 
             return {
               platform: 'Amazon', title, price, originalPrice, link,
               image, sourceAttr, candidates,
               imageCandidates: candidates || [],
               inStock: true
             };
           }, el, extractImageInBrowser.toString());
 
            if (data && data.link && data.link.startsWith('http')) {
              if (!data.image) {
                console.log(`[Amazon] Image recovery: "${data.title.substring(0, 40)}..." — waiting 2s and re-extracting`);
                await new Promise(r => setTimeout(r, 2000));
                await page.evaluate((element) => {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, el);
                await new Promise(r => setTimeout(r, 500));
                const recovered = await page.evaluate((element, extractImgFn) => {
                  const extractImg = new Function('return ' + extractImgFn)();
                  return extractImg(element, 'Amazon', window.location.href);
                }, el, extractImageInBrowser.toString());
                if (recovered && recovered.image) {
                  console.log(`[Amazon] Image recovery SUCCESS: ${recovered.image.substring(0, 80)}`);
                  data.image = recovered.image;
                  data.sourceAttr = recovered.sourceAttr;
                  data.imageCandidates = recovered.candidates || [];
                }
              }

              logImageExtraction('Amazon', data.title, data.image, data.sourceAttr, data.imageCandidates);
              results.push({
                platform: data.platform,
                title: data.title,
                price: data.price,
                originalPrice: data.originalPrice,
                link: data.link,
                image: data.image || null,
                imageCandidates: data.imageCandidates || [],
                inStock: true
              });
            }
        } catch (err) {
          console.warn(`[Amazon] Failed to parse product element: ${err.message}`);
        }
      }
      return results;
    }, query, jobId);
  }
}

module.exports = new AmazonScraper();
