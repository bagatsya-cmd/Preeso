const proxyManager = require('../utils/proxyManager');
const browserManager = require('../utils/browserManager');
const scrapeQueue = require('../utils/scrapeQueue');

class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.maxRetries = 3;
    this.timeoutMs = 15000;
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

          console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Timeout value being used: ${this.timeoutMs}ms`);

          let navigationSuccess = false;
          let waitUntilVal = 'load';
          try {
            let response = null;
            try {
              console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigating with waitUntil: "${waitUntilVal}"`);
              response = await page.goto(url, { waitUntil: waitUntilVal, timeout: this.timeoutMs });
            } catch (gotoErr) {
              if (gotoErr.message.includes('waitUntil') || gotoErr.message.includes('options.waitUntil')) {
                waitUntilVal = 'domcontentloaded';
                console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Failed with waitUntil error. Retrying with fallback waitUntil: "${waitUntilVal}"`);
                response = await page.goto(url, { waitUntil: waitUntilVal, timeout: this.timeoutMs });
              } else {
                throw gotoErr;
              }
            }

            if (response && (response.status() === 403 || response.status() === 429 || response.status() === 503)) {
              throw new Error(`Bot detected (${response.status()})`);
            }
            navigationSuccess = true;
            let title = '';
            try {
              title = await page.title();
            } catch (_) {}
            console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigation completed successfully with waitUntil: "${waitUntilVal}". Page title: "${title}"`);
          } catch (gotoErr) {
            let title = '';
            try {
              title = await page.title();
            } catch (_) {}

            if (!/timeout/i.test(gotoErr.message)) {
              console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigation failed. Page title: "${title}". Error: ${gotoErr.message}`);
              throw gotoErr;
            }
            console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigation timed out using waitUntil: "${waitUntilVal}". Page title: "${title}"`);
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
