/**
 * imageExtractor.js
 *
 * Robust image extraction and validation utility for direct use in web scraping page.evaluate blocks.
 * Contains both browser-side extraction logic and node-side logging/normalization.
 */

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

/**
 * Node-side URL cleaner
 */
function cleanImageUrl(url) {
  if (!url) return '';
  let cleaned = url.trim();
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  }
  // Remove Amazon size suffix
  cleaned = cleaned.replace(/\._[A-Z0-9_-]+_\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
  // Remove Myntra dynamic transforms
  cleaned = cleaned.replace(/(assets\.myntassets\.com)\/[^/]+\/(assets\/images)/i, '$1/$3');
  // Flipkart size upgrade
  cleaned = cleaned.replace(/(rukminim\d*\.flixcart\.com\/image)\/\d+\/\d+/i, '$1/832/832');
  return cleaned;
}

/**
 * Node-side URL validator
 */
function validateImageUrl(url, baseUrl) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim();
  if (!u) return null;

  if (u.startsWith('//')) u = 'https:' + u;

  // Convert relative to absolute
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    try {
      u = new URL(u, baseUrl).toString();
    } catch (_) {
      return null;
    }
  }

  if (u.toLowerCase().startsWith('data:')) return null;

  const lower = u.toLowerCase();
  const rejectTerms = [
    'placeholder', 'sprite', 'icon', 'logo', 'default',
    'base64', 'blank', 'transparent', 'noimage', 'no-image',
    'no_image', 'dummy', '1x1', '2x2', 'spacer', 'loading',
    'pixel', 'spinner', 'adsystem', 'analytics'
  ];

  for (const term of rejectTerms) {
    if (lower.includes(term)) return null;
  }

  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
  const pathOnly = lower.split('?')[0];
  const hasValidExt = validExtensions.some(ext => pathOnly.endsWith(ext));

  const knownCDNs = [
    'amazon.in', 'media-amazon', 'images-amazon',
    'fkimg.com', 'rukminim',
    'reliancedigital',
    'myntassets', 'myntraassets',
    'ajio',
    'nykaa', 'nykaafashion',
    'cloudinary'
  ];
  const isKnownCDN = knownCDNs.some(cdn => lower.includes(cdn));

  if (!hasValidExt && !isKnownCDN) return null;

  return u;
}

/**
 * Self-contained function to be executed inside browser page.evaluate context.
 *
 * @param {HTMLElement} cardElement  The DOM element representing the product card.
 * @param {string} retailer  The name of the retailer (e.g. 'Flipkart').
 * @param {string} baseUrl   The base URL of the page (usually window.location.href).
 * @returns {Object} { image: string|null, sourceAttr: string|null }
 */
function extractImageInBrowser(cardElement, retailer, baseUrl) {
  if (!cardElement) return { image: null, sourceAttr: null };

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

  const config = RETAILER_SELECTORS[retailer] || { primary: [], alternatives: [] };
  const allSelectors = [...config.primary, ...config.alternatives];

  const parseSrcset = (srcsetStr) => {
    if (!srcsetStr) return null;
    const parts = srcsetStr.split(',');
    if (parts.length > 0) {
      const firstPart = parts[0].trim();
      return firstPart.split(/\s+/)[0];
    }
    return null;
  };

  const getImgCandidates = (img) => {
    const candidates = [];
    if (!img) return candidates;

    // Check Amazon dynamic image mapping first as it has highest quality
    const dynData = img.getAttribute('data-a-dynamic-image');
    if (dynData) {
      try {
        const keys = Object.keys(JSON.parse(dynData));
        for (const key of keys) {
          if (key) candidates.push({ url: key, attr: 'data-a-dynamic-image' });
        }
      } catch (_) {}
    }

    // Check Amazon old hires image attribute
    const oldHires = img.getAttribute('data-old-hires');
    if (oldHires) {
      candidates.push({ url: oldHires, attr: 'data-old-hires' });
    }

    // Attempt multiple sources in order
    const attrs = [
      { name: 'src', val: img.src },
      { name: 'data-src', val: img.dataset?.src || img.getAttribute('data-src') },
      { name: 'data-lazy-src', val: img.dataset?.lazySrc || img.getAttribute('data-lazy-src') },
      { name: 'data-original', val: img.dataset?.original || img.getAttribute('data-original') },
      { name: 'data-image', val: img.getAttribute('data-image') }
    ];

    for (const attr of attrs) {
      if (attr.val) {
        candidates.push({ url: attr.val, attr: attr.name });
      }
    }

    // Check srcset
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      const parsed = parseSrcset(srcset);
      if (parsed) candidates.push({ url: parsed, attr: 'srcset' });
    }

    // Check picture > source srcset
    const picture = img.closest('picture');
    if (picture) {
      const sources = picture.querySelectorAll('source');
      for (const source of sources) {
        const sourceSrcset = source.getAttribute('srcset');
        if (sourceSrcset) {
          const parsed = parseSrcset(sourceSrcset);
          if (parsed) candidates.push({ url: parsed, attr: 'picture-srcset' });
        }
      }
    }

    return candidates;
  };

  const cleanUrl = (url) => {
    if (!url) return '';
    let cleaned = url.trim();
    if (cleaned.startsWith('//')) {
      cleaned = 'https:' + cleaned;
    }
    // Remove Amazon size suffix
    cleaned = cleaned.replace(/\._[A-Z0-9_-]+_\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
    // Remove Myntra dynamic transforms
    cleaned = cleaned.replace(/(assets\.myntassets\.com)\/[^/]+\/(assets\/images)/i, '$1/$3');
    // Flipkart size upgrade
    cleaned = cleaned.replace(/(rukminim\d*\.flixcart\.com\/image)\/\d+\/\d+/i, '$1/832/832');
    return cleaned;
  };

  const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    let u = url.trim();
    if (!u) return null;

    if (u.startsWith('//')) u = 'https:' + u;

    // Convert relative to absolute
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      try {
        u = new URL(u, baseUrl || window.location.origin).toString();
      } catch (_) {
        return null;
      }
    }

    if (u.toLowerCase().startsWith('data:')) return null;

    const lower = u.toLowerCase();
    const rejectTerms = [
      'placeholder', 'sprite', 'icon', 'logo', 'default',
      'base64', 'blank', 'transparent', 'noimage', 'no-image',
      'no_image', 'dummy', '1x1', '2x2', 'spacer', 'loading',
      'pixel', 'spinner', 'adsystem', 'analytics'
    ];

    for (const term of rejectTerms) {
      if (lower.includes(term)) return null;
    }

    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
    const pathOnly = lower.split('?')[0];
    const hasValidExt = validExtensions.some(ext => pathOnly.endsWith(ext));

    const knownCDNs = [
      'amazon.in', 'media-amazon', 'images-amazon',
      'fkimg.com', 'rukminim',
      'reliancedigital',
      'myntassets', 'myntraassets',
      'ajio',
      'nykaa', 'nykaafashion',
      'cloudinary'
    ];
    const isKnownCDN = knownCDNs.some(cdn => lower.includes(cdn));

    if (!hasValidExt && !isKnownCDN) return null;

    return u;
  };

  // 1. Try selectors in order
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

  // 2. Final Fallback: search the entire product card container for any img element
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

/**
 * Diagnostic logger for node-side use.
 *
 * @param {string} retailer
 * @param {string} title
 * @param {string|null} image
 * @param {string|null} sourceAttr
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
  RETAILER_SELECTORS,
  cleanImageUrl,
  validateImageUrl,
  extractImageInBrowser,
  logImageExtraction
};
