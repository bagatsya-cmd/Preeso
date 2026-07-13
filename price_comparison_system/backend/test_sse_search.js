const streamController = require('./src/controllers/streamController');
const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/price_comparison';
  console.log('Connecting to DB at:', uri);
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const query = process.argv[2] || 'kurti';
  console.log(`Starting search stream for query: "${query}"`);

  const req = {
    query: { q: query },
    on: (event, cb) => {
      console.log(`req.on('${event}') registered`);
    }
  };

  const res = {
    writeHead: (status, headers) => {
      console.log('--- HEADERS RECEIVED ---');
      console.log('Status:', status);
      console.log('Headers:', JSON.stringify(headers, null, 2));
      console.log('------------------------');
    },
    write: (data) => {
      const str = data.toString().trim();
      if (str === 'event: heartbeat\ndata: ping') {
        console.log('[HEARTBEAT] Ping sent');
      } else {
        console.log('[SSE DATA]:', str);
      }
    },
    flush: () => {},
    end: () => {
      console.log('--- STREAM CLOSED BY CONTROLLER ---');
      mongoose.disconnect();
      process.exit(0);
    }
  };

  await streamController.streamSearch(req, res);
}

run().catch(err => {
  console.error('Diagnostic run failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
