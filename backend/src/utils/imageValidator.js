// Updated imageValidator.js – stricter rejection and Flipkart whitelist

/**
 * Image Validation & Scoring Utility
 *
 * DEBUG MODE: Set DISABLE_IMAGE_VALIDATION=true in .env to bypass ALL
 * image rejection logic. Every image URL will be accepted as-is.
 */

// Hard‑reject if URL contains any of these terms (including badge/assured etc.)
const REJECT_TERMS = [
  'placeholder', 'sprite', 'icon', 'logo', 'default',
  'data:image', 'base64',
  'noimage', 'no-image', 'no_image', 'dummy',
  '1x1', '2x2', 'spacer', 'loading', 'pixel',
  'spinner', 'badge', 'assured', 'flipkart-assured', 'advert', 'ad/', '/ad',
  'static-assets-web', 'fk-cp-zion'
];

// Hard‑reject specific photo IDs (unchanged)
const BANNED_PHOTO_IDS = [
  'photo-1505740420928-5e560c06d30e' // headphone Unsplash
];

// Reject extensions (including .gif and .svg)
const REJECT_EXTENSIONS = ['.gif', '.svg'];

// Flipkart whitelist – at least one of these substrings must appear for a valid image
const FLIPKART_WHITELIST = ['rukminim'];

class ImageValidator {
  /** Normalise raw URL: protocol‑relative → https, trim whitespace. */
  normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    let u = url.trim();
    if (!u) return null;
    if (u.startsWith('//')) u = 'https:' + u;
    return u;
  }

  /** Return the cleaned URL if valid, else null. */
  validateImage(url) {
    const u = this.normalizeImageUrl(url);
    if (!u) return null;

    // ── DEBUG MODE: bypass all validation ──────────────────────────────────
    if (process.env.DISABLE_IMAGE_VALIDATION === 'true') {
      console.log(`[IMAGE_EXTRACTED] stage=imageValidator_validateImage image=${u}`);
      return u;
    }
    // ── END DEBUG MODE ─────────────────────────────────────────────────────

    // Reject data URIs of any kind
    if (u.toLowerCase().startsWith('data:')) return null;

    // Must be absolute HTTP/HTTPS
    if (!u.startsWith('http://') && !u.startsWith('https://')) return null;

    const lower = u.toLowerCase();

    // Reject banned photo IDs
    for (const id of BANNED_PHOTO_IDS) {
      if (lower.includes(id)) return null;
    }

    // Reject known bad terms
    for (const term of REJECT_TERMS) {
      if (lower.includes(term)) return null;
    }

    // Reject disallowed extensions
    for (const ext of REJECT_EXTENSIONS) {
      const pathOnly = lower.split('?')[0];
      if (pathOnly.endsWith(ext)) return null;
    }

    // Flipkart‑specific whitelist – ensure we are not picking a badge
    if (lower.includes('flipkart')) {
      const ok = FLIPKART_WHITELIST.some(p => lower.includes(p));
      if (!ok) return null;
    }

    return u;
  }

  /** Score a URL: higher = better product image. Returns -1 for invalid URLs. */
  scoreImage(url) {
    // ── DEBUG MODE: bypass scoring validation ─────────────────────────────
    if (process.env.DISABLE_IMAGE_VALIDATION === 'true') {
      const u = this.normalizeImageUrl(url);
      if (!u) return -1;
      return 10; // Always return a high positive score
    }
    // ── END DEBUG MODE ─────────────────────────────────────────────────────

    const u = this.validateImage(url);
    if (!u) return -1;
    const lower = u.toLowerCase();
    let score = 0;
    // Product keyword boosts (+5)
    const PRODUCT_KEYWORDS = [
      'iphone', 'samsung', 'oneplus', 'realme', 'redmi', 'pixel',
      'macbook', 'airpods', 'ipad', 'galaxy', 'nike', 'adidas',
      'handbag', 'saree', 'lipstick', 'cosmetic', 'fashion', 'beauty',
      'skincare', 'moisturizer', 'serum', 'foundation', 'perfume'
    ];
    for (const kw of PRODUCT_KEYWORDS) {
      if (lower.includes(kw)) { score += 5; break; }
    }
    // Known e‑commerce CDN boosts (+4)
    const GOOD_CDNS = [
      'amazon.in', 'm.media-amazon',
      'fkimg.com', 'rukminim',
      'reliancedigital',
      'myntassets', 'myntraassets',
      'ajio.com', 'ajioimages',
      'nykaa', 'nykaafashion',
      'cloudinary'
    ];
    for (const cdn of GOOD_CDNS) {
      if (lower.includes(cdn)) { score += 4; break; }
    }
    if (lower.includes('product')) score += 2;
    if (u.startsWith('https://')) score += 1;
    // Negative signals (demote)
    const BAD_TERMS = ['icon', 'logo', 'banner', 'placeholder', 'sprite', 'ad/', '/ad'];
    for (const bt of BAD_TERMS) {
      if (lower.includes(bt)) { score -= 5; break; }
    }
    if (/[_\\-](s|sx|sy|uy|ac)\\d{1,3}[_\\.]/i.test(lower)) score -= 2;
    return score;
  }

  /** From an array of raw URLs, return the highest‑scoring valid one. */
  pickBestImage(candidates) {
    let best = null;
    let bestScore = -Infinity;
    for (const url of (candidates || [])) {
      const s = this.scoreImage(url);
      if (s > bestScore) { bestScore = s; best = url; }
    }

    // ── DEBUG MODE: accept any candidate regardless of score ───────────────
    if (process.env.DISABLE_IMAGE_VALIDATION === 'true') {
      if (best !== null) {
        const normalized = this.normalizeImageUrl(best);
        console.log(`[IMAGE_EXTRACTED] stage=imageValidator_pickBestImage image=${normalized}`);
        return normalized;
      }
      return null;
    }
    // ── END DEBUG MODE ─────────────────────────────────────────────────────

    return (best !== null && bestScore >= 0) ? this.validateImage(best) : null;
  }

  /** getFallbackImage intentionally returns null — JSX placeholder only. */
  getFallbackImage() { return null; }
}

module.exports = new ImageValidator();
