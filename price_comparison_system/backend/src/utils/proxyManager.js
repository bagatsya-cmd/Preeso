/**
 * Proxy Manager for Rotating and Monitoring Proxies
 * Architecture ready for BrightData, Oxylabs, Smartproxy.
 */

const net = require('net');
const url = require('url');

class ProxyManager {
  constructor() {
    const envProxies = process.env.PROXIES || process.env.PROXY_LIST;
    this.proxies = envProxies 
      ? envProxies.split(',').map(p => p.trim()).filter(Boolean)
      : [];
    this.badProxies = new Set();
    this.usageStats = new Map();
    this.failureCounts = new Map();

    console.log(`[ProxyManager] Initialized with ${this.proxies.length} proxies.`);

    // Run initial health check on all proxies in the background
    this.runAllHealthChecks();

    // Periodically recheck and recover bad proxies automatically (every minute)
    setInterval(() => {
      this.recoverBadProxies();
    }, 60000);
  }

  /**
   * Fast socket connection check to see if proxy port is open.
   */
  async testProxyConnection(proxyUrl, timeout = 3000) {
    return new Promise((resolve) => {
      try {
        const parsed = url.parse(proxyUrl);
        const host = parsed.hostname;
        const port = parseInt(parsed.port || '80');
        if (!host || isNaN(port)) {
          return resolve(false);
        }
        
        const socket = net.connect({ host, port, timeout }, () => {
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      } catch (_) {
        resolve(false);
      }
    });
  }

  async runAllHealthChecks() {
    for (const p of this.proxies) {
      const isHealthy = await this.testProxyConnection(p);
      if (!isHealthy) {
        console.warn(`[ProxyManager] Proxy failed initial health check: ${p}`);
        this.badProxies.add(p);
      } else {
        console.log(`[ProxyManager] Proxy passed initial health check: ${p}`);
      }
    }
  }

  /**
   * Automatic recovery logic run every minute.
   * Cleans up proxies that pass a connection test.
   */
  async recoverBadProxies() {
    if (this.badProxies.size === 0) return;
    console.log(`[ProxyManager] Running health check on ${this.badProxies.size} bad proxies for recovery...`);
    for (const p of Array.from(this.badProxies)) {
      const isHealthy = await this.testProxyConnection(p);
      if (isHealthy) {
        console.log(`[ProxyManager] Recovered bad proxy: ${p}`);
        this.badProxies.delete(p);
        this.failureCounts.set(p, 0); // Reset failures
      }
    }
  }

  getProxy() {
    const availableProxies = this.proxies.filter(p => !this.badProxies.has(p));
    
    if (availableProxies.length === 0) {
      if (this.proxies.length > 0) {
        console.warn('[ProxyManager] All proxies are currently marked as bad! Attempting to fallback to a random proxy.');
        const fallbackProxy = this.proxies[Math.floor(Math.random() * this.proxies.length)];
        return fallbackProxy;
      }
      console.warn('[ProxyManager] No proxies configured. Falling back to direct connection.');
      return null;
    }

    // Random rotation among healthy ones
    const proxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
    this.usageStats.set(proxy, (this.usageStats.get(proxy) || 0) + 1);
    return proxy;
  }

  markBadProxy(proxy) {
    if (!proxy) return;
    const count = (this.failureCounts.get(proxy) || 0) + 1;
    this.failureCounts.set(proxy, count);
    
    // Unhealthy after repeated failures or instant block (e.g. 403, 429)
    console.error(`[ProxyManager] Marking proxy as bad (failures: ${count}): ${proxy}`);
    this.badProxies.add(proxy);
  }

  markHealthy(proxy) {
    if (!proxy) return;
    if (this.badProxies.has(proxy)) {
      console.log(`[ProxyManager] Proxy marked healthy: ${proxy}`);
      this.badProxies.delete(proxy);
    }
    this.failureCounts.set(proxy, 0);
  }

  markHealthyProxy(proxy) {
    this.markHealthy(proxy);
  }

  getStats() {
    return {
      total: this.proxies.length,
      healthy: this.proxies.length - this.badProxies.size,
      bad: this.badProxies.size,
      usage: Object.fromEntries(this.usageStats)
    };
  }
}

// Singleton export
module.exports = new ProxyManager();
