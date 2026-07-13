/**
 * Image Validation & Scoring Utility
 * Philosophy: allow-by-default, reject only clearly broken URLs, score by relevance.
 */

// Hard-reject if URL contains any of these
const REJECT_TERMS = [
  'placeholder', 'sprite', 'icon', 'logo', 'default',
  'data:image', 'base64', 'blank', 'transparent',
  'noimage', 'no-image', 'no_image', 'dummy',
  '1x1', '2x2', 'spacer', 'loading.gif', 'pixel.gif', 'spinner',
];

// Hard-reject specific photo IDs
const BANNED_PHOTO_IDS = [
  'photo-1505740420928-5e560c06d30e', // headphone Unsplash
];

// Reject if the URL ends with .gif (animated loader gifs)
const REJECT_EXTENSIONS = ['.gif'];

class ImageValidator {
  /**
   * Normalise raw URL: protocol-relative → https, trim whitespace.
   */
  normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    let u = url.trim();
    if (!u) return null;
    if (u.startsWith('//')) u = 'https:' + u;
    return u;
  }

  /**
   * Return the cleaned URL if valid, else null.
   */
  validateImage(url) {
    const u = this.normalizeImageUrl(url);
    if (!u) return null;

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

    // Reject gif extensions
    for (const ext of REJECT_EXTENSIONS) {
      const pathOnly = lower.split('?')[0];
      if (pathOnly.endsWith(ext)) return null;
    }

    return u;
  }

  /**
   * Score a URL: higher = better product image.
   * Returns -1 for invalid URLs (fails validateImage).
   */
  scoreImage(url) {
    const u = this.validateImage(url);
    if (!u) return -1;

    const lower = u.toLowerCase();
    let score = 0;

    // ── Product keyword boosts (+5) ───────────────────────────────────────────
    const PRODUCT_KEYWORDS = [
      'iphone', 'samsung', 'oneplus', 'realme', 'redmi', 'pixel',
      'macbook', 'airpods', 'ipad', 'galaxy', 'nike', 'adidas',
      // Fashion & beauty
      'handbag', 'saree', 'lipstick', 'cosmetic', 'fashion', 'beauty',
      'skincare', 'moisturizer', 'serum', 'foundation', 'perfume',
    ];
    for (const kw of PRODUCT_KEYWORDS) {
      if (lower.includes(kw)) { score += 5; break; } // only count once
    }

    // ── Known e-commerce CDN boosts (+4) ─────────────────────────────────────
    const GOOD_CDNS = [
      'amazon.in', 'm.media-amazon',
      'fkimg.com', 'rukminim',
      'reliancedigital',
      'myntassets', 'myntraassets',
      'ajio.com', 'ajioimages',
      'nykaa', 'nykaafashion',
      'cloudinary',
    ];
    for (const cdn of GOOD_CDNS) {
      if (lower.includes(cdn)) { score += 4; break; }
    }

    // ── Generic quality signals ───────────────────────────────────────────────
    if (lower.includes('product')) score += 2;
    if (u.startsWith('https://'))  score += 1;

    // ── Negative signals (demote, do not reject) (−5) ────────────────────────
    const BAD_TERMS = ['icon', 'logo', 'banner', 'placeholder', 'sprite', 'ad/', '/ad'];
    for (const bt of BAD_TERMS) {
      if (lower.includes(bt)) { score -= 5; break; }
    }

    // ── Penalise tiny dimension hints in the URL ──────────────────────────────
    // e.g. _SX38_, 32x32, _UY44_ — suggest thumbnail
    if (/[_\-](s|sx|sy|uy|ac)\d{1,3}[_\.]/i.test(lower)) score -= 2;

    return score;
  }

  /**
   * From an array of raw URLs, return the highest-scoring valid one.
   */
  pickBestImage(candidates) {
    let best = null;
    let bestScore = -Infinity;
    for (const url of (candidates || [])) {
      const s = this.scoreImage(url);
      if (s > bestScore) { bestScore = s; best = url; }
    }
    return (best !== null && bestScore >= 0) ? this.validateImage(best) : null;
  }

  /** getFallbackImage intentionally returns null — JSX placeholder only. */
  getFallbackImage() { return null; }
}

module.exports = new ImageValidator();
