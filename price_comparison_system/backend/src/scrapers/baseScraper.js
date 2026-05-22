const proxyManager = require('../utils/proxyManager');
const browserManager = require('../utils/browserManager');
const scrapeQueue = require('../utils/scrapeQueue');

class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.maxRetries = 1;
    // Strict timeouts: Myntra 4000ms, all others 5000ms
    this.timeoutMs = platformName === 'Myntra' ? 4000 : 5000;
  }

  /**
   * Core scrape wrapper with retry logic and proxy fallback
   */
  async scrapeWithRetry(url, scrapeFn) {
    let attempts = 0;
    let currentProxy = null;

    while (attempts < this.maxRetries) {
      attempts++;
      currentProxy = proxyManager.getProxy();
      let page = null;

      try {
        return await scrapeQueue.add(async () => {
          console.log(`[${this.platformName}] Attempt ${attempts} -> Navigating to ${url}`);
          page = await browserManager.getPage(currentProxy);

          try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs });
            if (response && (response.status() === 403 || response.status() === 429 || response.status() === 503)) {
              throw new Error(`Bot detected (${response.status()})`);
            }
          } catch (gotoErr) {
            if (!gotoErr.message.includes('Timeout')) {
              throw gotoErr;
            }
            console.log(`[${this.platformName}] Navigation timeout, attempting partial scrape...`);
          }

          const data = await scrapeFn(page);
          console.log(`[${this.platformName}] Success! Extracted data.`);
          return data;
        });

      } catch (error) {
        console.warn(`[${this.platformName}] Attempt ${attempts} failed: ${error.message}`);
        
        if (currentProxy) {
          proxyManager.markBadProxy(currentProxy);
        }

        if (attempts >= this.maxRetries) {
          console.error(`[${this.platformName}] All ${this.maxRetries} attempts failed.`);
          return [];
        }
        
        await new Promise(r => setTimeout(r, 1000));
      } finally {
        try {
          if (page && !page.isClosed()) {
            await page.close();
          }
        } catch (_) {}
      }
    }
  }

  // To be implemented by children
  async search(query) {
    throw new Error('Method "search" must be implemented by platform scraper.');
  }
}

module.exports = BaseScraper;
