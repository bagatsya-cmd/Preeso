const { default: PQueue } = require('p-queue');

// We use default export if available because p-queue commonjs interoperability sometimes returns an object with default
const QueueClass = PQueue || require('p-queue');

const scrapeQueue = new QueueClass({
  concurrency: 4
});

module.exports = scrapeQueue;
