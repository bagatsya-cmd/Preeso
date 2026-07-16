/**
 * imageExtractor.js
 *
 * Robust image extraction and validation utility for direct use in web scraping page.evaluate blocks.
 * Contains both browser-side extraction logic and node-side logging/normalization.
 *
 * Philosophy: Accept as many product images as possible.
 *   - Hard-reject ONLY: data: URIs, completely missing/empty URLs, non-http(s) schemes.
 *   - DO NOT gate on CDN whitelist — incomplete lists cause blank product images.
 *   - DO NOT reject on URL keywords ('default', 'loading', 'icon', etc.) — too aggressive.
 */

const RETAILER_SELECTORS = {
  Flipkart: {
    primary: [
      'img.UCc1lI', 'img.MZeksS', 'img._396cs4', 'img.DByuf4', 'img.CXW8mj',
      'img[src*="rukminim"]', 'img[src*="fkimg"]'
    ],
    alternatives: ['div[data-id] img', 'a img', 'img']
  },
  Myntra: {
    primary: [
      'img.img-responsive',
      'img[src*="myntassets"]', 'img[data-src*="myntassets"]'
    ],
    alternatives: ['li.product-base img', 'img']
  },
  AJIO: {
    primary: [
      'img.rilrtl-lazy-img',
      'img[src*="ajio"]', 'img[src*="fynd"]',
      'img[data-src*="ajio"]', 'img[data-src*="fynd"]'
    ],
    alternatives: ['.rilrtl-products-list__item img', 'img']
  },
  Nykaa: {
    primary: [
      '[data-test-id="product-card"] img',
      '[class*="productWrapper"] img',
      'a[href*="/p/"] img',
      'a[href*="productId="] img',
      'img[src*="nykaa"]', 'img[data-src*="nykaa"]'
    ],
    alternatives: ['img']
  },
  'Reliance Digital': {
    primary: [
      'a.product-card-image img', 'img.productImg',
      'img[src*="reliancedigital"]', 'img[data-src*="reliancedigital"]'
    ],
    alternatives: ['a.details-container img', 'img']
  },
  Amazon: {
    primary: [
      'img.s-image', 'img[data-image-latency]', 'img.a-dynamic-image',
      'img[src*="media-amazon"]', 'img[src*="images-amazon"]'
    ],
    alternatives: ['.s-result-item img', 'img']
  }
};

/**
 * Node-side URL cleaner.
 */
function cleanImageUrl(url) {
  if (!url) return '';
  let cleaned = url.trim();
  if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
  // Remove Amazon size suffix (e.g. ._AC_SY300_)
  cleaned = cleaned.replace(/\._[A-Z0-9_-]+_\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
  // Remove Myntra dynamic transforms
  cleaned = cleaned.replace(/(assets\.myntassets\.com)\/[^/]+\/(assets\/images)/i, '$1/$2');
  // Flipkart size upgrade (upgrade small thumbnails to high-res)
  cleaned = cleaned.replace(/(rukminim\d*\.flixcart\.com\/image)\/\d+\/\d+/i, '$1/832/832');
  return cleaned;
}

/**
 * Node-side URL validator — PERMISSIVE.
 * Hard-rejects only: data URIs, base64 blobs, missing/empty, non-http(s).
 * No CDN whitelist, no keyword blocklists.
 */
function validateImageUrl(url, baseUrl) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim();
  if (!u || u === 'about:blank') return null;
  if (u.startsWith('//')) u = 'https:' + u;

  // Convert relative to absolute
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    if (baseUrl) {
      try { u = new URL(u, baseUrl).toString(); } catch (_) { return null; }
    } else {
      return null;
    }
  }

  const lower = u.toLowerCase();
  if (lower.startsWith('data:')) return null;
  if (lower.includes('base64,')) return null;
  if (lower.includes('placeholder_fcebae.svg') ||
      lower.includes('fk-cp-zion/img/placeholder') ||
      (lower.includes('placeholder') && lower.includes('flixcart.com'))) {
    return null;
  }

  return u;
}

/**
 * Self-contained function to be executed inside browser page.evaluate context.
 *
 * @param {HTMLElement} cardElement  The DOM element representing the product card.
 * @param {string} retailer  The name of the retailer (e.g. 'Flipkart').
 * @param {string} baseUrl   The base URL of the page (usually window.location.href).
 * @returns {Object} { image: string|null, sourceAttr: string|null, candidates: Array }
 */
function extractImageInBrowser(cardElement, retailer, baseUrl) {
  if (!cardElement) return { image: null, sourceAttr: null, candidates: [] };

  // Inlined selectors (required for serialization into page.evaluate)
  var RETAILER_SELECTORS = {
    Flipkart: {
      primary: [
        'img.UCc1lI', 'img.MZeksS', 'img._396cs4', 'img.DByuf4', 'img.CXW8mj',
        'img[src*="rukminim"]', 'img[src*="fkimg"]'
      ],
      alternatives: ['div[data-id] img', 'a img', 'img']
    },
    Myntra: {
      primary: [
        'img.img-responsive',
        'img[src*="myntassets"]', 'img[data-src*="myntassets"]'
      ],
      alternatives: ['li.product-base img', 'img']
    },
    AJIO: {
      primary: [
        'img.rilrtl-lazy-img',
        'img[src*="ajio"]', 'img[src*="fynd"]',
        'img[data-src*="ajio"]', 'img[data-src*="fynd"]'
      ],
      alternatives: ['.rilrtl-products-list__item img', 'img']
    },
    Nykaa: {
      primary: [
        '[data-test-id="product-card"] img',
        '[class*="productWrapper"] img',
        'a[href*="/p/"] img',
        'a[href*="productId="] img',
        'img[src*="nykaa"]', 'img[data-src*="nykaa"]'
      ],
      alternatives: ['img']
    },
    'Reliance Digital': {
      primary: [
        'a.product-card-image img', 'img.productImg',
        'img[src*="reliancedigital"]', 'img[data-src*="reliancedigital"]'
      ],
      alternatives: ['a.details-container img', 'img']
    },
    Amazon: {
      primary: [
        'img.s-image', 'img[data-image-latency]', 'img.a-dynamic-image',
        'img[src*="media-amazon"]', 'img[src*="images-amazon"]'
      ],
      alternatives: ['.s-result-item img', 'img']
    }
  };

  var config = RETAILER_SELECTORS[retailer] || { primary: [], alternatives: [] };
  var allSelectors = config.primary.concat(config.alternatives);

  /**
   * Parse srcset string and return the highest-resolution URL.
   */
  var parseSrcset = function(srcsetStr) {
    if (!srcsetStr) return null;
    try {
      var parts = srcsetStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      if (!parts.length) return null;
      var entries = parts.map(function(p) {
        var tokens = p.split(/\s+/);
        return { url: tokens[0], value: parseFloat(tokens[1]) || 0 };
      });
      entries.sort(function(a, b) { return b.value - a.value; });
      return entries[0] ? entries[0].url : null;
    } catch (_) {
      var fp = srcsetStr.split(',')[0];
      return fp ? fp.trim().split(/\s+/)[0] : null;
    }
  };

  /**
   * Extract ALL possible image URL candidates from an <img> element.
   * Checks every known lazy-load, data-*, and srcset attribute.
   */
  var getImgCandidates = function(img) {
    var candidates = [];
    if (!img) return candidates;

    // Amazon dynamic image mapping (highest quality, JSON keys are full URLs)
    var dynData = img.getAttribute('data-a-dynamic-image');
    if (dynData) {
      try {
        var keys = Object.keys(JSON.parse(dynData));
        for (var i = 0; i < keys.length; i++) {
          if (keys[i]) candidates.push({ url: keys[i], attr: 'data-a-dynamic-image' });
        }
      } catch (_) {}
    }

    // Amazon old high-res
    var oldHires = img.getAttribute('data-old-hires');
    if (oldHires) candidates.push({ url: oldHires, attr: 'data-old-hires' });

    // All known lazy-load attributes — checked BEFORE src (src may be a placeholder)
    var lazyAttrs = [
      'data-src', 'data-lazy-src', 'data-original', 'data-image',
      'data-delayed-url', 'data-lazy', 'data-bg', 'data-url',
      'data-hi-res', 'data-zoom-image', 'data-echo', 'data-original-src',
      'data-img-src'
    ];
    for (var j = 0; j < lazyAttrs.length; j++) {
      var val = img.getAttribute(lazyAttrs[j]);
      if (val && val.length > 5) candidates.push({ url: val, attr: lazyAttrs[j] });
    }

    // src — added after lazy attrs since it may be a tiny 1px placeholder
    var src = img.src || img.getAttribute('src');
    if (src && src.length > 5) candidates.push({ url: src, attr: 'src' });

    // srcset (pick highest resolution)
    var srcset = img.getAttribute('srcset');
    if (srcset) {
      var parsedSrcset = parseSrcset(srcset);
      if (parsedSrcset) candidates.push({ url: parsedSrcset, attr: 'srcset' });
    }

    // data-srcset (pick highest resolution)
    var dataSrcset = img.getAttribute('data-srcset');
    if (dataSrcset) {
      var parsedDataSrcset = parseSrcset(dataSrcset);
      if (parsedDataSrcset) candidates.push({ url: parsedDataSrcset, attr: 'data-srcset' });
    }

    // picture > source[srcset] and picture > source[data-srcset]
    var picture = img.closest('picture');
    if (picture) {
      var sources = Array.from(picture.querySelectorAll('source'));
      for (var k = 0; k < sources.length; k++) {
        var ss = sources[k].getAttribute('srcset');
        if (ss) {
          var pss = parseSrcset(ss);
          if (pss) candidates.push({ url: pss, attr: 'picture-srcset' });
        }
        var dss = sources[k].getAttribute('data-srcset');
        if (dss) {
          var pdss = parseSrcset(dss);
          if (pdss) candidates.push({ url: pdss, attr: 'picture-data-srcset' });
        }
      }
    }

    return candidates;
  };

  var cleanUrl = function(url) {
    if (!url) return '';
    var cleaned = url.trim();
    if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
    cleaned = cleaned.replace(/\._[A-Z0-9_-]+_\.(jpg|jpeg|png|gif|webp)/i, '.$1');
    cleaned = cleaned.replace(/(assets\.myntassets\.com)\/[^/]+\/(assets\/images)/i, '$1/$2');
    cleaned = cleaned.replace(/(rukminim\d*\.flixcart\.com\/image)\/\d+\/\d+/i, '$1/832/832');
    return cleaned;
  };

  /**
   * Validate URL — PERMISSIVE.
   * Hard-rejects only: data URIs, base64 blobs, about:blank, non-http(s).
   */
  var validateUrl = function(url) {
    if (!url || typeof url !== 'string') return null;
    var u = url.trim();
    if (!u || u === 'about:blank') return null;
    if (u.startsWith('//')) u = 'https:' + u;
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      try {
        u = new URL(u, baseUrl || window.location.origin).toString();
      } catch (_) {
        return null;
      }
    }
    var lower = u.toLowerCase();
    if (lower.startsWith('data:')) return null;
    if (lower.includes('base64,')) return null;
    if (lower.includes('placeholder_fcebae.svg') ||
        lower.includes('fk-cp-zion/img/placeholder') ||
        (lower.includes('placeholder') && lower.includes('flixcart.com'))) {
      return null;
    }
    return u;
  };

  /**
   * Score an image candidate based on URL features and retailer-specific rules.
   */
  var scoreImage = function(url, ret) {
    if (!url) return -1000;
    var lower = url.toLowerCase();
    
    // Base checks (penalize data URIs / base64 extremely heavily)
    if (lower.startsWith('data:') || lower.includes('base64,')) {
      return -1000;
    }
    
    var score = 0;
    
    if (ret === 'Flipkart') {
      if (lower.includes('rukminim') || lower.includes('rukmini') || lower.includes('/image/')) {
        score += 100;
      }
      if (lower.includes('fk-cp-zion') || lower.includes('placeholder') || lower.includes('fa_') || lower.includes('fa-') || lower.endsWith('.svg')) {
        score -= 1000;
      }
    } else if (ret === 'AJIO') {
      if (lower.includes('ajio.com') || lower.includes('fynd.com') || lower.includes('/medias/') || lower.includes('/products/')) {
        score += 100;
      }
      if (lower.includes('white-star-display') || lower.includes('percentagefordesktop') || lower.includes('rating') || lower.includes('icon') || lower.includes('wishlist') || lower.endsWith('.svg')) {
        score -= 1000;
      }
    } else if (ret === 'Nykaa') {
      if (lower.includes('catalog/product') || lower.includes('nykaa') || lower.includes('/product/')) {
        score += 100;
      }
      if (lower.includes('defaultsale') || lower.includes('onlyatnykaa') || lower.includes('banner') || lower.includes('promo') || lower.endsWith('.svg')) {
        score -= 1000;
      }
    } else {
      // General defaults
      if (lower.includes('product') || lower.includes('image') || lower.includes('catalog')) {
        score += 10;
      }
      if (lower.includes('star') || lower.includes('badge') || lower.includes('logo') || lower.includes('icon') || lower.includes('placeholder') || lower.endsWith('.svg')) {
        score -= 1000;
      }
    }
    
    return score;
  };

  var scoredCandidates = [];
  var seenUrls = {};

  var addCandidate = function(url, attr) {
    var validated = validateUrl(cleanUrl(url));
    if (!validated) return;
    if (seenUrls[validated]) return;
    seenUrls[validated] = true;
    var score = scoreImage(validated, retailer);
    scoredCandidates.push({ url: validated, attr: attr, score: score });
  };

  // 1. Try selector matches
  for (var si = 0; si < allSelectors.length; si++) {
    var images;
    try { images = cardElement.querySelectorAll(allSelectors[si]); } catch (_) { continue; }
    for (var ii = 0; ii < images.length; ii++) {
      var candidates = getImgCandidates(images[ii]);
      for (var ci = 0; ci < candidates.length; ci++) {
        addCandidate(candidates[ci].url, candidates[ci].attr);
      }
    }
  }

  // 2. Final fallback: any <img> in the card container
  var allImgs = cardElement.querySelectorAll('img');
  for (var fi = 0; fi < allImgs.length; fi++) {
    var fcandidates = getImgCandidates(allImgs[fi]);
    for (var fci = 0; fci < fcandidates.length; fci++) {
      addCandidate(fcandidates[fci].url, fcandidates[fci].attr + '-fallback');
    }
  }

  // 3. CSS background-image last resort
  var allEls = cardElement.querySelectorAll('*');
  for (var bi = 0; bi < allEls.length; bi++) {
    try {
      var bgStyle = allEls[bi].style && allEls[bi].style.backgroundImage;
      if (bgStyle && bgStyle !== 'none') {
        var match = bgStyle.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1]) {
          addCandidate(match[1], 'background-image');
        }
      }
    } catch (_) {}
  }

  if (scoredCandidates.length === 0) {
    return { image: null, sourceAttr: null, candidates: [] };
  }

  // Sort candidates by score descending
  scoredCandidates.sort(function(a, b) { return b.score - a.score; });

  var best = scoredCandidates[0];
  if (best.score < 0) {
    return { image: null, sourceAttr: best.attr, candidates: scoredCandidates };
  }
  return { image: best.url, sourceAttr: best.attr, candidates: scoredCandidates };
}

/**
 * Diagnostic logger for node-side use.
 *
 * @param {string} retailer
 * @param {string} title
 * @param {string|null} image
 * @param {string|null} sourceAttr
 * @param {Array} candidates
 */
function logImageExtraction(retailer, title, image, sourceAttr, candidates) {
  const shortTitle = title ? (title.length > 30 ? title.substring(0, 30) + '...' : title) : 'Unknown Title';
  if (image) {
    console.log(`[IMAGE FOUND] ${retailer} | ${shortTitle} | ${sourceAttr || 'unknown'} | ${image.substring(0, 80)}`);
  } else {
    console.log(`[IMAGE MISSING] ${retailer} | ${shortTitle}`);
  }

  if (candidates && candidates.length > 0) {
    for (const c of candidates) {
      console.log(`[IMAGE SCORE]`);
      console.log(`retailer: ${retailer}`);
      console.log(`candidate: ${c.url}`);
      console.log(`score: ${c.score}`);
      console.log(`selected: ${c.url === image}`);
    }
  }
}

module.exports = {
  RETAILER_SELECTORS,
  cleanImageUrl,
  validateImageUrl,
  extractImageInBrowser,
  logImageExtraction
};
