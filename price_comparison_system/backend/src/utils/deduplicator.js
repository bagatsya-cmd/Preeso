const crypto = require('crypto');

/**
 * Normalizes a URL by converting to lowercase and stripping tracking/query parameters.
 */
function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().toLowerCase().trim();
  } catch (e) {
    // Fallback if URL parsing fails (e.g. relative or partial URLs)
    return url.split('?')[0].split('#')[0].toLowerCase().trim();
  }
}

/**
 * Extracts first 3 alphanumeric tokens to represent brand + model profile.
 */
function extractBrandModel(title) {
  const cleanTitle = (title || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleanTitle.split(' ').filter(w => w.length > 0);
  return words.slice(0, 3).join('-');
}

/**
 * Generates a soft MD5 hash based on normalized title, brand+model, source, and 5-10% price bucket.
 */
function generateSoftHash(title, price, source) {
  const cleanTitle = (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const brandModel = extractBrandModel(title);
  
  // Price bucket: group prices within 5% - 10% tolerance
  const actualPrice = Number(price) || 0;
  const logPrice = Math.max(1, actualPrice);
  const base = Math.max(10, Math.pow(10, Math.floor(Math.log10(logPrice)) - 1)); // 100 for 1000, 10 for 100
  const priceBucket = Math.round(actualPrice / base) * base;

  const rawString = `${source.toLowerCase()}:${cleanTitle}:${brandModel}:${priceBucket}`;
  return crypto.createHash('md5').update(rawString).digest('hex');
}

/**
 * Retained for legacy compatibility if required.
 */
function generateUniqueHash(title, url) {
  const cleanTitle = (title || '').toLowerCase().trim();
  const cleanUrl = normalizeUrl(url);
  return crypto
    .createHash('md5')
    .update(`${cleanTitle}:${cleanUrl}`)
    .digest('hex');
}

module.exports = {
  normalizeUrl,
  generateSoftHash,
  generateUniqueHash
};
