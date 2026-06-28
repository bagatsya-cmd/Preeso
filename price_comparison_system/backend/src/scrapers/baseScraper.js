const fs = require('fs');
const path = require('path');
const proxyManager = require('../utils/proxyManager');
const browserManager = require('../utils/browserManager');
const scrapeQueue = require('../utils/scrapeQueue');

const SNAPSHOT_DIR = path.join(__dirname, '../../../../debug-snapshots');

class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.maxRetries = 3;
    this.timeoutMs = 15000;
    this.skipInterception = false;
    this.containerSelector = null; // Subclasses should override this
  }

  /**
   * Hook for subclasses to prepare page (e.g. set headers, user agent) before navigation
   */
  async preparePage(page) {
    // Default implementation does nothing
  }

  /**
   * Core scrape wrapper with retry logic and proxy fallback
   */
  async scrapeWithRetry(url, scrapeFn, query = 'unknown') {
    const queryKey = query !== 'unknown' 
      ? query.toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s+/g, '_')
      : null;

    let attempts = 0;
    let currentProxy = null;

    while (attempts < this.maxRetries) {
      if (browserManager.isCancelled && browserManager.isCancelled(queryKey)) {
        console.log(`[${this.platformName}] Job is cancelled. Stopping scrape loop.`);
        break;
      }

      attempts++;
      currentProxy = proxyManager.getProxy();
      let page = null;

      try {
        return await scrapeQueue.add(async () => {
          if (browserManager.isCancelled && browserManager.isCancelled(queryKey)) {
            throw new Error('Cancelled');
          }

          console.log(`[${this.platformName}] Attempt ${attempts} -> Navigating to ${url}`);
          page = await browserManager.getPage(currentProxy, this.skipInterception, queryKey);

          // Invoke subclass preparePage hook
          if (typeof this.preparePage === 'function') {
            await this.preparePage(page);
          }

          console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Timeout value being used: ${this.timeoutMs}ms`);

          let navigationSuccess = false;
          let waitUntilVal = 'load';
          let response = null;

          try {
            console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigating with waitUntil: "${waitUntilVal}"`);
            response = await page.goto(url, { waitUntil: waitUntilVal, timeout: this.timeoutMs });
            
            if (response && (response.status() === 403 || response.status() === 429 || response.status() === 503)) {
              throw new Error(`Bot detected (${response.status()})`);
            }
            navigationSuccess = true;
          } catch (gotoErr) {
            // Fallback for waitUntil errors
            if (gotoErr.message.includes('waitUntil') || gotoErr.message.includes('options.waitUntil')) {
              waitUntilVal = 'domcontentloaded';
              console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Failed with waitUntil error. Retrying with fallback: "${waitUntilVal}"`);
              response = await page.goto(url, { waitUntil: waitUntilVal, timeout: this.timeoutMs });
              
              if (response && (response.status() === 403 || response.status() === 429 || response.status() === 503)) {
                throw new Error(`Bot detected (${response.status()})`);
              }
              navigationSuccess = true;
            } else {
              // Check if it's a timeout error
              if (!/timeout/i.test(gotoErr.message)) {
                let title = '';
                try { title = await page.title(); } catch (_) {}
                console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigation failed. Page title: "${title}". Error: ${gotoErr.message}`);
                throw gotoErr;
              }
              console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigation timed out using waitUntil: "${waitUntilVal}".`);
              console.log(`[${this.platformName}] Navigation timeout, attempting partial scrape...`);
            }
          }

          // Stabilization delay: 1.5 seconds post-navigation
          await new Promise(r => setTimeout(r, 1500));

          let title = '';
          try { title = await page.title(); } catch (_) {}

          let html = '';
          try { html = await page.content(); } catch (_) {}

          console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Navigation finished. Status: ${navigationSuccess ? 'SUCCESS' : 'TIMEOUT'}. Title: "${title}". HTML Length: ${html.length}`);

          // Run extraction
          const data = await scrapeFn(page);
          const count = data ? data.length : 0;
          console.log(`[${this.platformName}] [Attempt ${attempts}/${this.maxRetries}] Scrape function returned ${count} items.`);

          // Diagnostics if 0 items extracted
          if (count === 0) {
            console.log(`[${this.platformName}] [DIAGNOSTICS] 0 products extracted.`);
            
            // Check for CAPTCHA/Block
            const isBlocked = /captcha|robot|security|access denied|blocked/i.test(title) || /captcha|robot|security|access denied|blocked/i.test(html.substring(0, 10000));
            console.log(`[${this.platformName}] [DIAGNOSTICS] Block/CAPTCHA detected: ${isBlocked}`);
            console.log(`[${this.platformName}] [DIAGNOSTICS] Body text prefix (first 1000 chars):`);
            try {
              const bodyText = await page.evaluate(() => document.body.innerText);
              console.log(bodyText.substring(0, 1000));
            } catch (bodyErr) {
              console.log(html.substring(0, 1000));
            }

            // Check if expected selectors are in DOM
            if (this.containerSelector) {
              const containerCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, this.containerSelector);
              console.log(`[${this.platformName}] [DIAGNOSTICS] Expected selector "${this.containerSelector}" count: ${containerCount}`);
              
              // Save snapshot if container exists but 0 items extracted
              if (containerCount > 0 && html.length > 5000) {
                if (!fs.existsSync(SNAPSHOT_DIR)) {
                  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
                }
                const filename = `${this.platformName.toLowerCase().replace(/\s+/g, '-')}-${query.replace(/\s+/g, '-')}-${Date.now()}.html`;
                const filepath = path.join(SNAPSHOT_DIR, filename);
                fs.writeFileSync(filepath, html, 'utf8');
                console.log(`[${this.platformName}] [DIAGNOSTICS] Saved debug HTML snapshot to ${filepath}`);
              }
            } else {
              console.log(`[${this.platformName}] [DIAGNOSTICS] No containerSelector defined.`);
            }

            // If bot detected, throw error to trigger retry / proxy rotation
            if (isBlocked) {
              throw new Error('CAPTCHA/Block detected during diagnostics');
            }
          }

          return data;
        });
      } catch (error) {
        console.warn(`[${this.platformName}] Attempt ${attempts} failed: ${error.message}`);
        
        if (currentProxy) {
          proxyManager.markBadProxy(currentProxy);
        }

        if (browserManager.isCancelled && browserManager.isCancelled(queryKey)) {
          console.log(`[${this.platformName}] Cancelled. Breaking retry loop.`);
          break;
        }

        if (attempts >= this.maxRetries) {
          console.error(`[${this.platformName}] All ${this.maxRetries} attempts failed.`);
          return [];
        }
        
        await new Promise(r => setTimeout(r, 1000));
      } finally {
        try {
          if (page) {
            await browserManager.releasePage(page, queryKey);
          }
        } catch (_) {}
      }
    }
    return [];
  }

  // To be implemented by subclasses
  async search(query) {
    throw new Error('Method "search" must be implemented by platform scraper.');
  }
}

module.exports = BaseScraper;
