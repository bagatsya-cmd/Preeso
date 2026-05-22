const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  socket: {
    reconnectStrategy: (retries) => {
      // In production with a real URL, allow limited reconnects
      if (process.env.REDIS_URL || process.env.NODE_ENV === 'production') {
        if (retries > 10) return new Error('Max retries reached');
        return Math.min(retries * 100, 3000);
      }
      // In local dev, disable reconnect spam completely
      return false; 
    }
  }
});

let warned = false;

client.on('error', (err) => {
  if (!warned) {
    console.warn('Redis unavailable — running without cache.');
    warned = true;
  }
});

client.on('connect', () => {
  warned = false; // Reset if it ever connects
  console.log('Redis Client Connected');
});

// We completely remove the 'reconnecting' log spam as requested.

// Connect without crashing
(async () => {
  try {
    await client.connect();
  } catch (err) {
    // Caught by the error listener above
  }
})();

// Export a safe mock wrapper. If Redis is unavailable, it behaves identically to an empty cache.
const redisFallbackWrapper = {
  get isOpen() {
    return client.isOpen;
  },
  get: async (key) => {
    if (client.isOpen) return client.get(key);
    return null;
  },
  set: async (key, value, options) => {
    if (client.isOpen) return client.set(key, value, options);
    return null;
  },
  setEx: async (key, seconds, value) => {
    if (client.isOpen) return client.setEx(key, seconds, value);
    return null;
  },
  del: async (key) => {
    if (client.isOpen) return client.del(key);
    return null;
  }
};

module.exports = redisFallbackWrapper;
