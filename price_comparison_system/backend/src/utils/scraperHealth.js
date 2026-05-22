/**
 * Scraper Health Monitor
 * Tracks per-platform success rates, failure streaks, response times.
 * Auto-disables unstable platforms and re-enables after cooldown.
 */

const logger = require('./logger');

const FAILURE_THRESHOLD  = 5;          // consecutive failures before disabling
const COOLDOWN_MS        = 15 * 60 * 1000;  // 15 minutes
const MAX_HISTORY        = 50;         // keep last N results per platform

class ScraperHealth {
  constructor() {
    // Per-platform state
    this._platforms = {};
  }

  _ensure(platform) {
    if (!this._platforms[platform]) {
      this._platforms[platform] = {
        enabled:         true,
        disabledUntil:   null,
        consecutiveFails: 0,
        history:         [],   // { success: bool, ms: number, ts: Date }
      };
    }
    return this._platforms[platform];
  }

  // ── Called by streamController after each scraper attempt ───────────────────
  recordSuccess(platform, ms) {
    const p = this._ensure(platform);
    p.consecutiveFails = 0;
    if (!p.enabled && p.disabledUntil && Date.now() > p.disabledUntil) {
      p.enabled = true;
      p.disabledUntil = null;
      logger.info('Health', `${platform} re-enabled after cooldown`);
    }
    p.history.push({ success: true, ms, ts: Date.now() });
    if (p.history.length > MAX_HISTORY) p.history.shift();
    logger.scraper.success(platform, 0, ms); // count logged separately
  }

  recordFailure(platform, ms) {
    const p = this._ensure(platform);
    p.consecutiveFails++;
    p.history.push({ success: false, ms, ts: Date.now() });
    if (p.history.length > MAX_HISTORY) p.history.shift();

    if (p.consecutiveFails >= FAILURE_THRESHOLD) {
      p.enabled = false;
      p.disabledUntil = Date.now() + COOLDOWN_MS;
      logger.warn('Health', `${platform} DISABLED — ${p.consecutiveFails} consecutive failures. Cooldown until ${new Date(p.disabledUntil).toISOString()}`);
      // Auto re-enable after cooldown
      setTimeout(() => {
        p.enabled = true;
        p.disabledUntil = null;
        p.consecutiveFails = 0;
        logger.info('Health', `${platform} auto-re-enabled after cooldown`);
      }, COOLDOWN_MS);
    }
  }

  // ── Query ────────────────────────────────────────────────────────────────────
  isEnabled(platform) {
    const p = this._platforms[platform];
    if (!p) return true; // unknown platforms assumed healthy
    if (!p.enabled && p.disabledUntil && Date.now() > p.disabledUntil) {
      p.enabled = true;
      p.disabledUntil = null;
    }
    return p.enabled;
  }

  getHealth(platform) {
    const p = this._ensure(platform);
    const recent = p.history.slice(-20);
    const successCount = recent.filter(h => h.success).length;
    const avgMs = recent.length
      ? Math.round(recent.reduce((s, h) => s + h.ms, 0) / recent.length)
      : null;

    return {
      enabled:          p.enabled,
      disabledUntil:    p.disabledUntil ? new Date(p.disabledUntil).toISOString() : null,
      consecutiveFails: p.consecutiveFails,
      successRate:      recent.length ? `${Math.round((successCount / recent.length) * 100)}%` : 'N/A',
      avgResponseMs:    avgMs,
      sampleSize:       recent.length,
    };
  }

  getAllHealth() {
    const result = {};
    for (const platform of Object.keys(this._platforms)) {
      result[platform] = this.getHealth(platform);
    }
    return result;
  }

  reset(platform) {
    const p = this._ensure(platform);
    p.enabled = true;
    p.disabledUntil = null;
    p.consecutiveFails = 0;
  }
}

module.exports = new ScraperHealth();
