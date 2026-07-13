/**
 * Query Normalizer
 * Only normalizes casing and spacing to preserve full query meaning.
 * Never strips digits or model tokens.
 */
const normalizeQuery = (q) => {
  if (!q) return '';
  return q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
};

module.exports = { normalizeQuery };
