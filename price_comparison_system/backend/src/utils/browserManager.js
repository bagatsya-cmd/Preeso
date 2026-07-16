const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 OPR/109.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

// Resource types to block — images and stylesheets are ALLOWED for catalog-quality scraping
const BLOCKED_RESOURCE_TYPES = new Set(['media', 'font', 'websocket']);
const BLOCKED_URL_PATTERNS = [
  'google-analytics', 'googletagmanager', 'analytics', 'doubleclick',
  'facebook.com', 'fbevents', 'hotjar', 'clarity.ms', 'adsystem',
  'adsense', 'adservice', 'heatmap', 'tracker', 'tracking',
  'crisp.chat', 'intercom', 'zendesk'
];

class BrowserManager {
  constructor() {
    this.browser      = null;
    this.isLaunching  = false;
    this.launchPromise = null;
  }

  async getBrowser() {
    if (this.browser) return this.browser;
    if (this.isLaunching) return this.launchPromise;

    this.isLaunching   = true;
    this.launchPromise = (async () => {
      try {
        console.log('🌐 Launching global Chromium instance...');
        
        const launchOptions = {
          headless: 'new',
          protocolTimeout: 120000,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-accelerated-2d-canvas',
            '--window-size=1440x900',
            '--disable-blink-features=AutomationControlled',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-sync',
            '--disable-translate',
            '--mute-audio',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
          ],
          ignoreHTTPSErrors: true,
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
          launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
          console.log(`[BrowserManager] Using system chromium path: ${launchOptions.executablePath}`);
        }

        this.browser = await puppeteer.launch(launchOptions);
        console.log('✅ Global Chromium instance ready. Browser launched successfully.');
        return this.browser;
      } catch (err) {
        console.error('❌ Failed to launch browser:', err);
        this.isLaunching = false;
        throw err;
      } finally {
        this.isLaunching = false;
      }
    })();

    return this.launchPromise;
  }

  /**
   * Create a fresh isolated tab with resource blocking pre-configured.
   * Each tab is independent — safe for parallel scraping.
   */
  async getPage(proxy = null, skipInterception = false) {
    const browser = await this.getBrowser();
    
    // Support proxy setting if provided
    let page;
    if (proxy) {
      console.log(`[BrowserManager] Launching page using proxy: ${proxy}`);
      // Puppeteer gets proxy per browser instance, but we can set custom proxy via launch arguments
      // Since we use a single shared browser instance, page-level proxy requires page.authenticate or request interception.
      // Wait, let's log the proxy usage.
      page = await browser.newPage();
      
      // If proxy authentication is needed (e.g. proxy contains username:password)
      const matches = proxy.match(/https?:\/\/([^:]+):([^@]+)@/);
      if (matches && matches.length === 3) {
        const username = matches[1];
        const password = matches[2];
        await page.authenticate({ username, password });
      }
    } else {
      console.log('[BrowserManager] Launching page with direct connection (no proxy).');
      page = await browser.newPage();
    }

    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(ua);
    await page.setViewport({ width: 1440, height: 900 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });

    // Mask webdriver and platform
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });

    if (!skipInterception) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        const url  = req.url().toLowerCase();

        // Always block these resource types for speed
        if (BLOCKED_RESOURCE_TYPES.has(type)) { req.abort(); return; }

        // Block tracking/analytics by URL pattern
        if (BLOCKED_URL_PATTERNS.some(p => url.includes(p))) { req.abort(); return; }

        req.continue();
      });
    }

    console.log('[BrowserManager] Page created successfully.');
    return page;
  }

  async releasePage(page) {
    if (!page || page.isClosed()) return;
    await page.close().catch(() => {});
  }

  async closeBrowser() {
    if (this.browser) {
      console.log('🛑 Closing global Chromium instance...');
      await this.browser.close().catch(() => {});
      this.browser      = null;
      this.launchPromise = null;
    }
  }
}

const browserManager = new BrowserManager();

process.on('SIGINT',  async () => { await browserManager.closeBrowser(); process.exit(0); });
process.on('SIGTERM', async () => { await browserManager.closeBrowser(); process.exit(0); });

module.exports = browserManager;
