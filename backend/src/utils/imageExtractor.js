/**
 * imageExtractor.js
 *
 * Robust image extraction utility for web scraping.
 * 
 * CRITICAL: extractImageInBrowser() is serialized via .toString() and executed
 * in the browser via page.evaluate(). Therefore it MUST be entirely self-contained.
 * All helper functions, constants, and reject-lists MUST be defined INSIDE the
 * function body — no references to module-scope variables are allowed.
 *
 * DEBUG MODE: When disableImageValidation is passed as true, ALL reject logic
 * inside the browser function is bypassed.
 */

/**
 * Self-contained function executed inside browser page.evaluate context.
 *
 * @param {HTMLElement} cardElement  The DOM element representing the product card.
 * @param {string} retailer  The name of the retailer (e.g. 'Flipkart').
 * @param {string} baseUrl   The base URL of the page (usually window.location.href).
 * @param {boolean} disableImageValidation  If true, bypass all reject logic.
 * @returns {Object} { image: string|null, sourceAttr: string|null }
 */
function extractImageInBrowser(cardElement, retailer, baseUrl, disableImageValidation) {
  if (!cardElement) return { image: null, sourceAttr: null };

  // ── All constants MUST be inside this function (browser context) ──────────

  const RETAILER_SELECTORS = {
    Flipkart: {
      primary: ['img.MZeksS', 'img._396cs4', 'img.DByuf4', 'img.CXW8mj'],
      alternatives: ['div[data-id] img', 'a img', 'img']
    },
    Myntra: {
      primary: ['img.img-responsive'],
      alternatives: ['li.product-base img', 'img']
    },
    AJIO: {
      primary: ['img.rilrtl-lazy-img'],
      alternatives: ['.rilrtl-products-list__item img', 'img']
    },
    Nykaa: {
      primary: ['[data-test-id="product-card"] img', '[class*="productWrapper"] img', 'a[href*="/p/"] img', 'a[href*="productId="] img'],
      alternatives: ['img']
    },
    'Reliance Digital': {
      primary: ['a.product-card-image img', 'img.productImg'],
      alternatives: ['a.details-container img', 'img']
    },
    Amazon: {
      primary: ['img.s-image', 'img[data-image-latency]', 'img.a-dynamic-image'],
      alternatives: ['.s-result-item img', 'img']
    }
  };

  const REJECT_TERMS = [
    'logo', 'assured', 'flipkart-assured', 'badge', 'icon', 'placeholder',
    'spinner', 'loading', 'pixel', 'sprite', 'default',
    'noimage', 'no-image', 'no_image', 'dummy',
    '1x1', '2x2', 'spacer', 'adsystem', 'analytics',
    'static-assets-web', 'fk-cp-zion'
  ];

  const FLIPKART_WHITELIST = ['rukminim'];

  // ── Helper: parse srcset and return the highest-res URL ───────────────────
  const parseSrcset = (srcsetStr) => {
    if (!srcsetStr || !srcsetStr.trim()) return null;
    const parts = srcsetStr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    let bestUrl = null;
    let bestScore = -1;
    for (const part of parts) {
      const tokens = part.split(/\s+/);
      const url = tokens[0];
      if (!url) continue;
      const descriptor = tokens[1] || '';
      let score = 0;
      const m = descriptor.match(/(\d+)(w|x)$/i);
      if (m) score = parseInt(m[1], 10);
      if (score > bestScore) { bestScore = score; bestUrl = url; }
    }
    return bestUrl || parts[0].split(/\s+/)[0] || null;
  };

  // ── Helper: clean URL ─────────────────────────────────────────────────────
  const cleanUrl = (url) => {
    if (!url) return '';
    let cleaned = url.trim();
    if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
    // Remove Amazon size suffix
    cleaned = cleaned.replace(/\._[A-Z0-9_-]+_\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
    // Flipkart size upgrade
    cleaned = cleaned.replace(/(rukminim\d*\.flixcart\.com\/image)\/\d+\/\d+/i, '$1/832/832');
    return cleaned;
  };

  // ── Helper: validate URL ──────────────────────────────────────────────────
  const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    let u = url.trim();
    if (!u) return null;
    if (u.startsWith('//')) u = 'https:' + u;

    // Must be absolute HTTP(S)
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      try {
        u = new URL(u, baseUrl || window.location.origin).toString();
      } catch (_) {
        return null;
      }
    }

    // ── DEBUG MODE: bypass all reject logic ────────────────────────────────
    if (disableImageValidation) {
      console.log(`[IMAGE_EXTRACTED] stage=browser_extraction retailer=${retailer} image=${u}`);
      return u;
    }
    // ── END DEBUG MODE ─────────────────────────────────────────────────────

    if (u.toLowerCase().startsWith('data:')) return null;

    const lower = u.toLowerCase();

    // Reject known bad terms
    for (const term of REJECT_TERMS) {
      if (lower.includes(term)) {
        console.log(`[REJECT-TERM] Rejected: "${u}" due to term "${term}"`);
        return null;
      }
    }

    // Reject SVG and GIF (placeholders/badges)
    const pathOnly = lower.split('?')[0];
    if (pathOnly.endsWith('.svg') || pathOnly.endsWith('.gif')) {
      console.log(`[REJECT-EXT] Rejected: "${u}" due to extension`);
      return null;
    }

    // Flipkart-specific: must match at least one CDN pattern
    if (retailer === 'Flipkart') {
      const ok = FLIPKART_WHITELIST.some(p => lower.includes(p));
      if (!ok) {
        console.log(`[REJECT-WHITELIST] Rejected: "${u}" due to Flipkart whitelist`);
        return null;
      }
    }

    return u;
  };

  // ── Helper: gather candidate URLs from an <img> element ───────────────────
  const getImgCandidates = (img) => {
    const candidates = [];
    if (!img) return candidates;

    // Amazon dynamic image mapping (highest quality)
    const dynData = img.getAttribute('data-a-dynamic-image');
    if (dynData) {
      try {
        const keys = Object.keys(JSON.parse(dynData));
        for (const key of keys) {
          if (key) candidates.push({ url: key, attr: 'data-a-dynamic-image' });
        }
      } catch (_) {}
    }

    const oldHires = img.getAttribute('data-old-hires');
    if (oldHires) candidates.push({ url: oldHires, attr: 'data-old-hires' });

    // Prioritized attribute list (srcset first, src last)
    const attrs = [
      { name: 'srcset',        val: img.getAttribute('srcset') },
      { name: 'data-srcset',   val: img.getAttribute('data-srcset') },
      { name: 'data-src',      val: img.dataset?.src || img.getAttribute('data-src') },
      { name: 'data-lazy-src', val: img.dataset?.lazySrc || img.getAttribute('data-lazy-src') },
      { name: 'data-original', val: img.dataset?.original || img.getAttribute('data-original') },
      { name: 'data-image',    val: img.getAttribute('data-image') },
    ];

    // Flipkart-specific lazy-load attributes
    if (retailer === 'Flipkart') {
      attrs.push(
        { name: 'data-lazy', val: img.getAttribute('data-lazy') },
        { name: 'data-url',  val: img.getAttribute('data-url') }
      );
    }

    // src last — it's often a placeholder on lazy-loaded pages
    attrs.push({ name: 'src', val: img.src || img.getAttribute('src') });

    for (const attr of attrs) {
      if (!attr.val || !attr.val.trim()) continue;

      // If this is a srcset/data-srcset, parse it to extract best URL
      if (attr.name === 'srcset' || attr.name === 'data-srcset') {
        const parsed = parseSrcset(attr.val);
        if (parsed) candidates.push({ url: parsed, attr: attr.name });
      } else {
        candidates.push({ url: attr.val, attr: attr.name });
      }
    }

    // Check <picture> > <source> elements
    const picture = img.closest('picture');
    if (picture) {
      const sources = picture.querySelectorAll('source');
      for (const source of sources) {
        const srcset = source.getAttribute('srcset');
        if (srcset) {
          const parsed = parseSrcset(srcset);
          if (parsed) candidates.push({ url: parsed, attr: 'picture-srcset' });
        }
      }
    }

    return candidates;
  };

  // ── Main extraction logic ─────────────────────────────────────────────────
  const config = RETAILER_SELECTORS[retailer] || { primary: [], alternatives: [] };
  const allSelectors = [...config.primary, ...config.alternatives];

  // 1. Try retailer-specific selectors in order
  for (const selector of allSelectors) {
    const images = cardElement.querySelectorAll(selector);
    for (const img of images) {
      const candidates = getImgCandidates(img);
      for (const cand of candidates) {
        const validated = validateUrl(cleanUrl(cand.url));
        if (validated) {
          return { image: validated, sourceAttr: cand.attr };
        }
      }
    }
  }

  // 2. Fallback: any <img> in the card
  const allImgs = cardElement.querySelectorAll('img');
  for (const img of allImgs) {
    const candidates = getImgCandidates(img);
    for (const cand of candidates) {
      const validated = validateUrl(cleanUrl(cand.url));
      if (validated) {
        return { image: validated, sourceAttr: cand.attr + '-fallback' };
      }
    }
  }

  return { image: null, sourceAttr: null };
}

// ── Node-side helpers (NOT used in browser context) ───────────────────────────

/**
 * Node-side URL cleaning — same logic as browser cleanUrl but available
 * for scrapers that parse JSON responses outside the browser.
 */
function cleanImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim();
  if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
  cleaned = cleaned.replace(/\._[A-Z0-9_-]+_\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
  cleaned = cleaned.replace(/(rukminim\d*\.flixcart\.com\/image)\/\d+\/\d+/i, '$1/832/832');
  return cleaned;
}

/**
 * Node-side URL validation — simplified version for JSON-extracted URLs.
 * When DISABLE_IMAGE_VALIDATION=true, bypasses all reject logic.
 */
function validateImageUrl(url, baseUrl) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim();
  if (!u) return null;
  if (u.startsWith('//')) u = 'https:' + u;

  // Resolve relative URLs
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    try {
      u = new URL(u, baseUrl).toString();
    } catch (_) {
      return null;
    }
  }

  // ── DEBUG MODE: bypass all reject logic ──────────────────────────────────
  if (process.env.DISABLE_IMAGE_VALIDATION === 'true') {
    console.log(`[IMAGE_EXTRACTED] stage=node_validateImageUrl image=${u}`);
    return u;
  }
  // ── END DEBUG MODE ───────────────────────────────────────────────────────

  if (u.toLowerCase().startsWith('data:')) return null;

  const lower = u.toLowerCase();
  const REJECT_TERMS = [
    'logo', 'assured', 'flipkart-assured', 'badge', 'icon', 'placeholder',
    'spinner', 'loading', 'pixel', 'sprite', 'default',
    'noimage', 'no-image', 'no_image', 'dummy',
    '1x1', '2x2', 'spacer', 'adsystem', 'analytics',
    'static-assets-web', 'fk-cp-zion'
  ];
  for (const term of REJECT_TERMS) {
    if (lower.includes(term)) return null;
  }

  const pathOnly = lower.split('?')[0];
  if (pathOnly.endsWith('.svg') || pathOnly.endsWith('.gif')) return null;

  return u;
}

/**
 * Diagnostic logger — prints to backend console.
 */
function logImageExtraction(retailer, title, image, sourceAttr) {
  const shortTitle = title ? (title.length > 30 ? title.substring(0, 30) + '...' : title) : 'Unknown Title';
  if (image) {
    console.log(`[IMAGE FOUND] ${retailer} | ${shortTitle} | ${sourceAttr || 'unknown'}`);
  } else {
    console.log(`[IMAGE MISSING] ${retailer} | ${shortTitle}`);
  }
}

module.exports = {
  extractImageInBrowser,
  logImageExtraction,
  cleanImageUrl,
  validateImageUrl
};
