// In production: const { Queue } = require('bullmq');
// const Redis = require('ioredis');

// const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Mocking for architecture layout without dependencies installed yet
class MockQueue {
  constructor(name) {
    this.name = name;
  }
  async add(jobName, data, opts) {
    console.log(`[Queue: ${this.name}] Added job: ${jobName}`, data);
    // In actual implementation, this adds to Redis
    return { id: Math.random().toString(36).substring(7) };
  }
}

// const searchQueue = new Queue('SearchScrapingQueue', { connection });
const searchQueue = new MockQueue('SearchScrapingQueue');

module.exports = {
  searchQueue,
  // connection
};
