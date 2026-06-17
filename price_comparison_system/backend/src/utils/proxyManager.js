/**
 * Proxy Manager for Rotating and Monitoring Proxies
 * Architecture ready for BrightData, Oxylabs, Smartproxy.
 */

class ProxyManager {
  constructor() {
    // In production, these should be loaded from env or a database.
    const envProxies = process.env.PROXIES || process.env.PROXY_LIST;
    this.proxies = envProxies 
      ? envProxies.split(',').map(p => p.trim()).filter(Boolean)
      : [];
    this.badProxies = new Set();
    this.usageStats = new Map();
  }

  getProxy() {
    const availableProxies = this.proxies.filter(p => !this.badProxies.has(p));
    
    if (availableProxies.length === 0) {
      console.warn('[ProxyManager] No healthy proxies available. Falling back to direct connection.');
      return null;
    }

    // Random rotation
    const proxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
    
    // Track usage
    this.usageStats.set(proxy, (this.usageStats.get(proxy) || 0) + 1);
    
    return proxy;
  }

  markBadProxy(proxy) {
    if (proxy) {
      console.error(`[ProxyManager] Marking proxy as bad: ${proxy}`);
      this.badProxies.add(proxy);
      
      // Auto-recover proxies after 1 hour (TTL)
      setTimeout(() => {
        this.badProxies.delete(proxy);
        console.log(`[ProxyManager] Proxy recovered: ${proxy}`);
      }, 60 * 60 * 1000);
    }
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
