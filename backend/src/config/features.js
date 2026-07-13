/**
 * Centralized feature flags.
 *
 * All scraping-related behaviour gates MUST import SCRAPING_ENABLED from this
 * module instead of reading process.env.ENABLE_SCRAPING directly.
 */

const SCRAPING_ENABLED = process.env.ENABLE_SCRAPING === 'true';

module.exports = {
  SCRAPING_ENABLED
};
