const redis = require('redis');
const EventEmitter = require('events');

const localEmitter = new EventEmitter();
let redisPublisher = null;
let redisSubscriber = null;
let isRedisAvailable = false;

// Track active Redis subscriptions to avoid duplicate subscriptions
const redisSubscriptions = new Map();

if (process.env.REDIS_URL) {
  try {
    const url = process.env.REDIS_URL;
    redisPublisher = redis.createClient({ url });
    redisSubscriber = redis.createClient({ url });
    
    redisPublisher.on('error', (err) => {
      // Quiet logging for Redis pubsub connection failures
    });
    redisSubscriber.on('error', (err) => {
      // Quiet logging for Redis pubsub connection failures
    });
    
    Promise.all([
      redisPublisher.connect(),
      redisSubscriber.connect()
    ]).then(() => {
      isRedisAvailable = true;
      console.log('✅ Redis Pub/Sub Connected');
    }).catch(err => {
      console.warn('Redis Pub/Sub failed to connect. Falling back to local EventEmitter.');
    });
  } catch (err) {
    console.warn('Redis Pub/Sub initialization failed. Falling back to local EventEmitter.');
  }
} else {
  console.log('No REDIS_URL configured. Using local EventEmitter.');
}

const pubSub = {
  async publish(channel, message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    if (isRedisAvailable && redisPublisher?.isOpen) {
      try {
        await redisPublisher.publish(channel, payload);
      } catch (err) {
        console.error(`[PubSub] Redis publish failed for channel ${channel}:`, err.message);
        // Fallback to local emitter in case Redis client was opened but publish failed
        localEmitter.emit(channel, payload);
      }
    } else {
      localEmitter.emit(channel, payload);
    }
  },

  async subscribe(channel, callback) {
    if (isRedisAvailable && redisSubscriber?.isOpen) {
      try {
        if (!redisSubscriptions.has(channel)) {
          redisSubscriptions.set(channel, new Set());
          await redisSubscriber.subscribe(channel, (message) => {
            const callbacks = redisSubscriptions.get(channel);
            if (callbacks) {
              for (const cb of callbacks) {
                cb(message);
              }
            }
          });
        }
        redisSubscriptions.get(channel).add(callback);
      } catch (err) {
        console.error(`[PubSub] Redis subscribe failed for channel ${channel}:`, err.message);
        localEmitter.on(channel, callback);
      }
    } else {
      localEmitter.on(channel, callback);
    }
  },

  async unsubscribe(channel, callback) {
    if (isRedisAvailable && redisSubscriber?.isOpen) {
      try {
        const callbacks = redisSubscriptions.get(channel);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            redisSubscriptions.delete(channel);
            await redisSubscriber.unsubscribe(channel);
          }
        }
      } catch (err) {
        console.error(`[PubSub] Redis unsubscribe failed for channel ${channel}:`, err.message);
        localEmitter.off(channel, callback);
      }
    } else {
      localEmitter.off(channel, callback);
    }
  }
};

module.exports = pubSub;
