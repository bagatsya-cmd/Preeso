const BaseScraper = require('./baseScraper');
const imageValidator = require('../utils/imageValidator');
const { extractImageInBrowser, logImageExtraction, cleanImageUrl, validateImageUrl } = require('../utils/imageExtractor');

class RelianceScraper extends BaseScraper {
  constructor() {
    super('Reliance Digital');
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

  async search(query, jobId = null) {
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
            const link = slug ? `https://www.reliancedigital.in/product/${slug}` : `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}`;
            
            // Image extraction from medias
            let image = null;
            const imageCandidates = [];
            if (item.medias && item.medias.length > 0) {
              item.medias.forEach((m, idx) => {
                if (m.url) {
                  const cleaned = cleanImageUrl(m.url);
                  const validated = validateImageUrl(cleaned, 'https://www.reliancedigital.in');
                  if (validated) {
                    imageCandidates.push({
                      url: validated,
                      attr: `json-medias[${idx}]`,
                      score: idx === 0 ? 100 : 90
                    });
                  }
                }
              });
              if (imageCandidates.length > 0) {
                image = imageCandidates[0].url;
              }
            }
            logImageExtraction('Reliance Digital', title, image, image ? 'json' : null);

            items.push({
              title,
              price,
              originalPrice: price,
              link,
              image,
              imageCandidates,
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
      await page.waitForSelector(this.containerSelector, { timeout: 15000 }).then(() => {
        hydrated = true;
        console.log('[Reliance Digital] React app hydrated successfully.');
      }).catch(() => {
        console.log('[Reliance Digital] details-container not found within 15s. Hydration status: failed or delayed.');
      });

      // Scroll to trigger lazy loading of images
      await page.evaluate(async () => {
        for (let i = 0; i < 6; i++) {
          window.scrollBy(0, 600);
          await new Promise(r => setTimeout(r, 400));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 1000));
      });

      // Wait for network to settle after scrolling
      try {
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
      } catch (_) {}

      const rawProducts = await page.evaluate((extractImgFn) => {
        const items = [];
        const detailAnchors = Array.from(document.querySelectorAll('a.details-container'));
        const extractImg = new Function('return ' + extractImgFn)();

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
            const container   = grandparent || anchor;

             const imgResult = extractImg(container, 'Reliance Digital', window.location.href);
             const image = imgResult.image;
             const sourceAttr = imgResult.sourceAttr;
             const candidates = imgResult.candidates;

             items.push({ title, price, link, image, sourceAttr, candidates, imageCandidates: candidates || [] });
           } catch (e) {}
         }
         return items;
       }, extractImageInBrowser.toString());

      // Image recovery for products missing images
      for (let i = 0; i < rawProducts.length; i++) {
        const p = rawProducts[i];
        if (p && p.title && p.price && !p.image) {
          console.log(`[Reliance Digital] Image recovery: "${p.title.substring(0, 40)}..." — waiting 2s and re-extracting`);
          await new Promise(r => setTimeout(r, 2000));

          const recovered = await page.evaluate((idx, extractImgFn) => {
            const detailAnchors = Array.from(document.querySelectorAll('a.details-container'));
            const anchor = detailAnchors[idx];
            if (!anchor) return null;
            const parent      = anchor.parentElement;
            const grandparent = parent ? parent.parentElement : null;
            const container   = grandparent || anchor;
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const extractImg = new Function('return ' + extractImgFn)();
            return extractImg(container, 'Reliance Digital', window.location.href);
          }, i, extractImageInBrowser.toString());

          if (recovered && recovered.image) {
            console.log(`[Reliance Digital] Image recovery SUCCESS: ${recovered.image.substring(0, 80)}`);
            rawProducts[i].image = recovered.image;
            rawProducts[i].sourceAttr = recovered.sourceAttr;
            rawProducts[i].candidates = recovered.candidates;
            rawProducts[i].imageCandidates = recovered.candidates || [];
          } else {
            console.log(`[Reliance Digital] Image recovery FAILED for: "${p.title.substring(0, 40)}..."`);
          }
        }
      }

       console.log(`[Reliance Digital] Hydration status: ${hydrated ? 'hydrated' : 'not-hydrated'}. Raw scrape returned ${rawProducts.length} items.`);

       return rawProducts.map(p => {
         logImageExtraction('Reliance Digital', p.title, p.image, p.sourceAttr, p.candidates);
        return {
          title: p.title,
          price: p.price,
          link: p.link,
          image: p.image || null,
          imageCandidates: p.imageCandidates || [],
          originalPrice: p.price,
          platform: 'Reliance Digital',
          inStock: true
        };
      });
    }, query, jobId);
  }
}

module.exports = new RelianceScraper();
