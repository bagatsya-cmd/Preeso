/**
 * Image Validation & Scoring Utility
 *
 * Philosophy: allow-by-default, reject only clearly broken/invalid URLs, score by relevance.
 *
 * IMPORTANT: validateImage is PERMISSIVE — it does NOT use a CDN whitelist or keyword blocklist.
 * Only hard rejects: data URIs, base64 blobs, non-http(s), and empty strings.
 * The scoring logic (scoreImage) is used to RANK candidates, not filter them.
 */

// Hard-reject specific known placeholder/tracker photo IDs
const BANNED_PHOTO_IDS = [
  'photo-1505740420928-5e560c06d30e', // generic headphone Unsplash image
];

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
   *
   * PERMISSIVE: only hard-rejects:
   *   - data: URIs (inline base64 images)
   *   - base64 blobs
   *   - about:blank / empty strings
   *   - non-http(s) schemes
   *   - specific known bad photo IDs
   *
   * Does NOT reject based on CDN whitelist or URL keywords like 'loading', 'default', 'icon', etc.
   */
  validateImage(url) {
    const u = this.normalizeImageUrl(url);
    if (!u || u === 'about:blank') return null;

    const lower = u.toLowerCase();

    // Hard-reject data URIs
    if (lower.startsWith('data:')) return null;

    // Hard-reject base64 blobs
    if (lower.includes('base64,')) return null;

    // Must be absolute HTTP/HTTPS
    if (!u.startsWith('http://') && !u.startsWith('https://')) return null;

    // Reject specific banned photo IDs (e.g. known wrong Unsplash images)
    for (const id of BANNED_PHOTO_IDS) {
      if (lower.includes(id)) return null;
    }

    return u;
  }

  /**
   * Score a URL: higher = better product image.
   * Returns -1 for invalid URLs (fails validateImage).
   * Used to RANK candidates, not filter them.
   */
  scoreImage(url) {
    const u = this.validateImage(url);
    if (!u) return -1;

    const lower = u.toLowerCase();
    let score = 0;

    // ── Product keyword boosts (+5) ──────────────────────────────────────────
    const PRODUCT_KEYWORDS = [
      'iphone', 'samsung', 'oneplus', 'realme', 'redmi', 'pixel',
      'macbook', 'airpods', 'ipad', 'galaxy', 'nike', 'adidas',
      // Fashion & beauty
      'handbag', 'saree', 'lipstick', 'cosmetic', 'fashion', 'beauty',
      'skincare', 'moisturizer', 'serum', 'foundation', 'perfume',
    ];
    for (const kw of PRODUCT_KEYWORDS) {
      if (lower.includes(kw)) { score += 5; break; }
    }

    // ── Known e-commerce CDN boosts (+4) ────────────────────────────────────
    const GOOD_CDNS = [
      'amazon.in', 'm.media-amazon',
      'fkimg.com', 'rukminim',
      'reliancedigital',
      'myntassets', 'myntraassets',
      'ajio.com', 'ajioimages', 'fynd.com',
      'nykaa', 'nykaafashion',
      'cloudinary',
    ];
    for (const cdn of GOOD_CDNS) {
      if (lower.includes(cdn)) { score += 4; break; }
    }

    // ── Generic quality signals ──────────────────────────────────────────────
    if (lower.includes('product')) score += 2;
    if (u.startsWith('https://'))  score += 1;

    // ── Known image extensions (+1) ─────────────────────────────────────────
    const pathOnly = lower.split('?')[0];
    const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
    if (IMAGE_EXTS.some(ext => pathOnly.endsWith(ext))) score += 1;

    // ── Negative signals (demote, do NOT reject) ─────────────────────────────
    const BAD_TERMS = ['sprite', 'banner', 'ad/', '/ad'];
    for (const bt of BAD_TERMS) {
      if (lower.includes(bt)) { score -= 5; break; }
    }

    // ── Penalise tiny dimension hints in the URL (thumbnail signals) ─────────
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
    // Accept any validated URL even with score 0 (no CDN boost, no extension — still a valid URL)
    return (best !== null && bestScore >= 0) ? this.validateImage(best) : null;
  }

  /** getFallbackImage intentionally returns null — JSX placeholder only. */
  getFallbackImage() { return null; }
}

module.exports = new ImageValidator();
