const { fork } = require('child_process');
const path = require('path');

let scraperProcess = null;
let aggregatorProcess = null;

function startWorkers() {
  if (process.env.DISABLE_AUTO_WORKERS === 'true') {
    console.log('[WorkerManager] Auto background workers are disabled.');
    return;
  }

  console.log('[WorkerManager] Spawning background workers as child processes...');

  // 1. Spawning Scraper Worker
  const scraperPath = path.join(__dirname, '../workers/scraperWorker.js');
  scraperProcess = fork(scraperPath, [], {
    env: { ...process.env, RUNNING_AS_CHILD: 'true' }
  });

  scraperProcess.on('exit', (code, signal) => {
    console.log(`[WorkerManager] Scraper worker exited (code: ${code}, signal: ${signal}). Restarting in 5s...`);
    setTimeout(startWorkers, 5000);
  });

  scraperProcess.on('error', (err) => {
    console.error('[WorkerManager] Scraper worker process error:', err.message);
  });

  // 2. Spawning Aggregator Worker
  const aggregatorPath = path.join(__dirname, '../workers/aggregatorWorker.js');
  aggregatorProcess = fork(aggregatorPath, [], {
    env: { ...process.env, RUNNING_AS_CHILD: 'true' }
  });

  aggregatorProcess.on('exit', (code, signal) => {
    console.log(`[WorkerManager] Aggregator worker exited (code: ${code}, signal: ${signal}). Restarting in 5s...`);
    setTimeout(startWorkers, 5000);
  });

  aggregatorProcess.on('error', (err) => {
    console.error('[WorkerManager] Aggregator worker process error:', err.message);
  });

  // Automatically kill children when parent exits
  process.on('exit', () => {
    if (scraperProcess) scraperProcess.kill();
    if (aggregatorProcess) aggregatorProcess.kill();
  });
}

function stopWorkers() {
  console.log('[WorkerManager] Terminating background worker processes...');
  if (scraperProcess) scraperProcess.kill();
  if (aggregatorProcess) aggregatorProcess.kill();
}

function getScraperProcess() {
  return scraperProcess;
}

module.exports = {
  startWorkers,
  stopWorkers,
  getScraperProcess
};
