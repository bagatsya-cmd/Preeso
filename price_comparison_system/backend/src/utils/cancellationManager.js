const ScrapeJob = require('../models/scrapeJob');

// Maps jobId (string) -> Set of Puppeteer page objects
const activePages = new Map();

function registerPage(jobId, page) {
  if (!jobId) return;
  const idStr = jobId.toString();
  if (!activePages.has(idStr)) {
    activePages.set(idStr, new Set());
  }
  activePages.get(idStr).add(page);
}

function unregisterPage(jobId, page) {
  if (!jobId) return;
  const idStr = jobId.toString();
  const pages = activePages.get(idStr);
  if (pages) {
    pages.delete(page);
    if (pages.size === 0) {
      activePages.delete(idStr);
    }
  }
}

/**
 * Checks if the job has been cancelled in the database.
 * If cancelled, throws a "JOB_CANCELLED" error.
 */
async function checkCancelled(jobId) {
  if (!jobId) return;
  if (process.env.NODE_ENV !== 'production') return;

  const job = await ScrapeJob.findById(jobId).lean();
  if (job && job.status === 'cancelled') {
    throw new Error('JOB_CANCELLED');
  }
}

/**
 * Force-cancels a job: updates database status to 'cancelled'
 * and closes all Puppeteer pages registered to this job.
 */
async function cancelJob(jobId) {
  if (!jobId) return;
  const idStr = jobId.toString();
  console.log(`[CancellationManager] Cancelling job ${idStr}...`);

  // Update DB status
  await ScrapeJob.findByIdAndUpdate(jobId, {
    $set: { status: 'cancelled', updatedAt: new Date() }
  });

  // Close all open pages for this job
  const pages = activePages.get(idStr);
  if (pages) {
    for (const page of pages) {
      try {
        if (!page.isClosed()) {
          await page.close();
          console.log(`[CancellationManager] Force-closed page for job ${idStr}`);
        }
      } catch (err) {
        console.error(`[CancellationManager] Error closing page for job ${idStr}:`, err.message);
      }
    }
    activePages.delete(idStr);
  }
}

module.exports = {
  registerPage,
  unregisterPage,
  checkCancelled,
  cancelJob
};
