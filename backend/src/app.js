const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL,
  methods:     ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/products', require('./routes/product'));
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/stream',   require('./routes/stream'));
app.use('/api/system',   require('./routes/system'));

// Legacy health endpoint (kept for backward compat)
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Background services ───────────────────────────────────────────────────────
const { startAlertService }   = require('./services/alertService');
const refreshScheduler         = require('./services/refreshScheduler');
const precacher                = require('./workers/precacher');
const browserManager           = require('./utils/browserManager');
const { stopWorkers }          = require('./utils/workerManager');

startAlertService();
refreshScheduler.start();

// if (process.env.NODE_ENV === 'production') {
//   precacher.start();
// } else {
//   console.log('[PRECACHER] Disabled in development mode');
// }
console.log('[PRECACHER] Disabled for current deployment phase');

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[App] Received ${signal} — shutting down gracefully...`);
  refreshScheduler.stop();
  precacher.stop();
  stopWorkers();
  await browserManager.closeBrowser();
  console.log('[App] Shutdown complete.');
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException',  err => console.error('[App] Uncaught:', err));
process.on('unhandledRejection', err => console.error('[App] Unhandled rejection:', err));

module.exports = app;
