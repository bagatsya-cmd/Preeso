/**
 * Matching and Normalization Service
 * Merges products from different platforms, enforces relevance, and clusters variants.
 *
 * Phase 11: Fashion/beauty products use strict similarity thresholds and
 *           preserve colour, size, and shade variants as separate cards.
 *
 * Phase 12: QUERY INTENT CLASSIFICATION — Electronics searches NEVER show
 *           fashion/accessory products. Platform-aware category routing.
 *           Hard accessory rejection before similarity scoring.
 */

const { classifyQuery } = require('../utils/queryClassifier');

// ── Phase 12: Query Intent keyword sets ──────────────────────────────────────
const ELECTRONICS_INTENT_WORDS = new Set([
  'iphone', 'ipad', 'macbook', 'samsung', 'pixel', 'oneplus', 'redmi', 'realme',
  'laptop', 'tablet', 'phone', 'smartphone', 'tv', 'television', 'monitor',
  'airpods', 'earbuds', 'smartwatch', 'watch', 'headphones', 'speaker',
  'router', 'keyboard', 'mouse', 'webcam', 'printer', 'camera', 'drone',
  'ps5', 'xbox', 'nintendo', 'gpu', 'cpu', 'ram', 'ssd', 'hdd',
]);

const FASHION_INTENT_WORDS = new Set([
  'kurti', 'kurta', 'kurtis', 'saree', 'sari', 'lehenga', 'dupatta', 'blouse',
  'heels', 'handbag', 'tote', 'dress', 'jeans', 'tshirt', 't-shirt', 'shirt',
  'shoes', 'sneakers', 'sandal', 'boot', 'skirt', 'hoodie', 'jacket', 'coat',
  'ethnic', 'salwar', 'palazzo', 'kurti', 'anarkali', 'churidar',
]);

const BEAUTY_INTENT_WORDS = new Set([
  'lipstick', 'serum', 'skincare', 'foundation', 'makeup', 'perfume',
  'moisturizer', 'moisturiser', 'kajal', 'kohl', 'mascara', 'eyeliner',
  'blush', 'highlighter', 'concealer', 'primer', 'sunscreen', 'toner',
  'shampoo', 'conditioner', 'hair mask', 'fragrance', 'deodorant',
]);

// Accessory terms — if query contains these, accessories are allowed even for electronics
const ACCESSORY_INTENT_WORDS = new Set([
  'case', 'cover', 'sleeve', 'pouch', 'bag', 'handbag', 'tote', 'cable',
  'charger', 'protector', 'screen guard', 'tempered', 'stand', 'holder',
  'strap', 'skin', 'mount', 'adapter',
]);

// Hard-reject accessory title tokens for electronics queries (no explicit accessory intent)
const ACCESSORY_TITLE_TOKENS = [
  'tote', 'bag', 'handbag', 'sleeve', 'pouch', 'cover', 'case',
  'protector', 'strap', 'wallet', 'satchel', 'backpack', 'sling',
];

// ── Electronics accessory blacklist (still applies to electronics queries) ────
const ACCESSORY_BLACKLIST = [
  'case', 'cover', 'charger', 'cable', 'skin', 'tempered', 'protector',
  'adapter', 'screen', 'guard', 'glass', 'strap',
  'pouch', 'stand', 'holder', 'mount', 'ring', 'pop', 'sleeve',
];

// ── Fashion/beauty blacklist — items that should NEVER group with products ────
const FASHION_BLACKLIST = [
  'dupatta', 'blouse piece', 'refill', 'sample', 'tester',
  'fabric only', 'unstitched', 'combo of',
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'on', 'at',
  'new', 'buy', 'best', 'top', 'latest', 'good', 'great',
]);

// ── Fashion/beauty platform names ─────────────────────────────────────────────
const FASHION_PLATFORMS = new Set(['AJIO', 'Nykaa', 'Myntra']);

// Signals that this is a fashion/beauty query
const FASHION_KEYWORDS = /dress|saree|kurti|kurta|blouse|lehenga|dupatta|top|jeans|skirt|hoodie|jacket|shoe|heel|sandal|boot|sneaker|handbag|bag|wallet|lipstick|makeup|skincare|serum|moisturiser|moisturizer|foundation|kajal|kohl|mascara|eyeliner|blush|perfume|fragrance|deodor|shampoo|conditioner|hair/i;

// Variant signals: if these differ between two products, DO NOT merge
const COLOUR_WORDS = /\b(red|blue|green|black|white|pink|yellow|orange|purple|grey|gray|brown|beige|cream|navy|olive|maroon|coral|teal|cyan|magenta|lavender|gold|silver|rose|nude|ivory|charcoal)\b/i;
const SIZE_WORDS   = /\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|uk\s?\d+|eu\s?\d+|us\s?\d+|\d+\s*(ml|gm|g|kg|oz|fl\.? oz))\b/i;
const SHADE_WORDS  = /\b(shade|shade[-\s]?\d+|no\.?\s*\d+|\d{3,4})\b/i;

function generateStableId(url, title, platform) {
  const input = url || `${title}-${platform}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'prod_' + Math.abs(hash).toString(36);
}

class MatchingService {

  // ── Phase 12: Detect query intent ─────────────────────────────────────────
  /**
   * Returns one of: 'electronics' | 'fashion' | 'beauty' | 'accessories' | 'general'
   */
  detectQueryIntent(query) {
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/);

    // Check for explicit accessory intent
    const hasAccessoryIntent = tokens.some(t => ACCESSORY_INTENT_WORDS.has(t)) ||
      [...ACCESSORY_INTENT_WORDS].some(term => new RegExp(`\\b${term}\\b`, 'i').test(q));

    // Check electronics intent
    const hasElectronicsIntent = tokens.some(t => ELECTRONICS_INTENT_WORDS.has(t)) ||
      [...ELECTRONICS_INTENT_WORDS].some(term => new RegExp(`\\b${term}\\b`, 'i').test(q));

    // Check fashion intent
    const hasFashionIntent = tokens.some(t => FASHION_INTENT_WORDS.has(t)) ||
      [...FASHION_INTENT_WORDS].some(term => new RegExp(`\\b${term}\\b`, 'i').test(q));

    // Check beauty intent
    const hasBeautyIntent = tokens.some(t => BEAUTY_INTENT_WORDS.has(t)) ||
      [...BEAUTY_INTENT_WORDS].some(term => new RegExp(`\\b${term}\\b`, 'i').test(q));

    // Electronics + accessory terms = accessories intent (e.g. "ipad cover")
    if (hasElectronicsIntent && hasAccessoryIntent) return 'accessories';

    // Pure electronics
    if (hasElectronicsIntent) return 'electronics';

    // Pure beauty
    if (hasBeautyIntent && !hasFashionIntent) return 'beauty';

    // Fashion (includes beauty+fashion combos)
    if (hasFashionIntent) return 'fashion';

    // Beauty alone
    if (hasBeautyIntent) return 'beauty';

    // Fall through to classifyQuery for general classification
    const classified = classifyQuery(query);
    if (classified === 'electronics') return 'electronics';
    if (classified === 'fashion') return 'fashion';
    if (classified === 'beauty') return 'beauty';

    return 'general';
  }

  // ── Phase 12: Hard accessory rejection for electronics queries ────────────
  /**
   * Returns true if the product title contains accessory tokens that should
   * be rejected when the query intent is 'electronics' (no accessory intent).
   */
  isAccessoryProduct(title) {
    const lower = title.toLowerCase();
    return ACCESSORY_TITLE_TOKENS.some(token => {
      // Word-boundary check — "bag" should not match "baggage" etc.
      const regex = new RegExp(`\\b${token}\\b`, 'i');
      return regex.test(lower);
    });
  }

  // ── Phase 12: Cross-category product isolation ────────────────────────────
  /**
   * Returns true if this product should be REJECTED given the detected
   * query intent. Electronics queries reject fashion/accessory products;
   * fashion queries reject unrelated electronics.
   */
  isCrossCategoryContaminant(product, queryIntent) {
    const title    = (product.title || '').toLowerCase();
    const platform = (product.platform || '').toLowerCase();

    if (queryIntent === 'electronics') {
      // Reject products from fashion-only platforms
      if (FASHION_PLATFORMS.has(product.platform)) {
        if (process.env.DEBUG_MATCHING === 'true') console.log(`[MATCH-REJECT] reason=fashion-platform-in-electronics query_intent=electronics platform=${product.platform} title="${product.title}"`);
        return true;
      }
      // Reject fashion keyword titles
      if (FASHION_KEYWORDS.test(product.title || '')) {
        if (process.env.DEBUG_MATCHING === 'true') console.log(`[MATCH-REJECT] reason=fashion-keyword-in-electronics query_intent=electronics title="${product.title}"`);
        return true;
      }
      // Reject accessory titles (hard reject before similarity)
      if (this.isAccessoryProduct(product.title || '')) {
        if (process.env.DEBUG_MATCHING === 'true') console.log(`[MATCH-REJECT] reason=accessory-mismatch query_intent=electronics title="${product.title}"`);
        return true;
      }
    }

    if (queryIntent === 'fashion' || queryIntent === 'beauty') {
      // Reject pure electronics from fashion queries (e.g. cables showing up in saree searches)
      const isElectronicsProduct = [...ELECTRONICS_INTENT_WORDS].some(kw =>
        new RegExp(`\\b${kw}\\b`, 'i').test(product.title || '')
      );
      if (isElectronicsProduct && !FASHION_PLATFORMS.has(product.platform)) {
        if (process.env.DEBUG_MATCHING === 'true') console.log(`[MATCH-REJECT] reason=electronics-in-fashion query_intent=${queryIntent} title="${product.title}"`);
        return true;
      }
    }

    return false;
  }

  normalizeString(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isFashionQuery(query) {
    const intent = this.detectQueryIntent(query);
    return intent === 'fashion' || intent === 'beauty';
  }

  isFashionProduct(product) {
    if (FASHION_PLATFORMS.has(product.platform)) return true;
    const cat = classifyQuery(product.title || '');
    return cat === 'fashion' || cat === 'beauty' || FASHION_KEYWORDS.test(product.title || '');
  }

  isAccessory(query, title) {
    // Only apply electronics accessory filter when query is NOT fashion
    if (this.isFashionQuery(query)) return false;
    const qNorm = this.normalizeString(query);
    const tNorm = this.normalizeString(title);
    for (const term of ACCESSORY_BLACKLIST) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(tNorm) && !new RegExp(`\\b${term}\\b`, 'i').test(qNorm)) return true;
    }
    return false;
  }

  isFashionBlacklisted(title) {
    const lower = title.toLowerCase();
    return FASHION_BLACKLIST.some(term => lower.includes(term));
  }

  isRelevant(query, title) {
    const qNorm = this.normalizeString(query);
    const tNorm = this.normalizeString(title);
    
    const stem = (w) => {
      let stemmed = w.replace(/s$/, ''); // plurals
      if (stemmed.endsWith('i')) stemmed = stemmed.slice(0, -1) + 'a'; // kurti -> kurta
      return stemmed;
    };
    
    const queryTokens = qNorm.split(' ').filter(t => t.length > 1 && !STOP_WORDS.has(t));
    if (queryTokens.length === 0) return true;
    
    const titleWords = tNorm.split(' ');
    
    return queryTokens.some(token => {
      const stemmedToken = stem(token);
      return tNorm.includes(token) || 
             titleWords.some(w => stem(w) === stemmedToken);
    });
  }

  // ── Variant guard: two fashion products should NOT merge if they differ in colour/size/shade ──
  variantsMustSeparate(title1, title2) {
    const c1 = (title1.match(COLOUR_WORDS) || [])[0]?.toLowerCase();
    const c2 = (title2.match(COLOUR_WORDS) || [])[0]?.toLowerCase();
    if (c1 && c2 && c1 !== c2) return true;

    const s1 = (title1.match(SIZE_WORDS) || [])[0]?.toLowerCase().replace(/\s/g, '');
    const s2 = (title2.match(SIZE_WORDS) || [])[0]?.toLowerCase().replace(/\s/g, '');
    if (s1 && s2 && s1 !== s2) return true;

    const sh1 = (title1.match(SHADE_WORDS) || [])[0]?.toLowerCase();
    const sh2 = (title2.match(SHADE_WORDS) || [])[0]?.toLowerCase();
    if (sh1 && sh2 && sh1 !== sh2) return true;

    return false;
  }

  tokenize(normalizedStr) {
    let s = normalizedStr
      .replace(/\b(gigas|gigabytes)\b/g, 'gb')
      .replace(/\b(teras|terabytes)\b/g, 'tb');
    const tokens = s.split(' ').filter(Boolean);

    const storageMatch = s.match(/\b(\d+)\s*(gb|tb)\b(?!\s*ram)/);
    const ramMatch     = s.match(/\b(\d+)\s*(gb|mb)\b\s*(ram|memory)/) || s.match(/\b(\d+)\s*(gb|mb)\b/);
    const storage = storageMatch ? `${storageMatch[1]}${storageMatch[2]}` : null;

    let ram = null;
    if (ramMatch && ramMatch[3]) {
      ram = `${ramMatch[1]}${ramMatch[2]}`;
    } else if (ramMatch && ramMatch[1] !== (storageMatch ? storageMatch[1] : null)) {
      ram = `${ramMatch[1]}${ramMatch[2]}`;
    }

    const modelMatch = s.match(
      /\b(iphone\s*\d+\s*(?:pro\s*max|pro|plus|mini)?|s\d+\s*(?:ultra|fe|plus)?|pixel\s*\d+\s*(?:pro\s*xl|pro|a)?|m\d+|gen\s*\d+|nothing\s*phone\s*\d*)\b/
    );
    const model = modelMatch ? modelMatch[1].replace(/\s+/g, '') : null;

    return { storage, ram, model, tokens: new Set(tokens) };
  }

  calculateSimilarity(str1, str2) {
    const norm1 = this.normalizeString(str1);
    const norm2 = this.normalizeString(str2);
    const tok1  = this.tokenize(norm1);
    const tok2  = this.tokenize(norm2);

    // Hard mismatches on electronics specs — preserved from Phase 11
    if (tok1.storage && tok2.storage && tok1.storage !== tok2.storage) return 0;
    if (tok1.ram     && tok2.ram     && tok1.ram     !== tok2.ram)     return 0;
    if (tok1.model   && tok2.model   && tok1.model   !== tok2.model)   return 0;

    const intersection = new Set([...tok1.tokens].filter(x => tok2.tokens.has(x)));
    const union        = new Set([...tok1.tokens, ...tok2.tokens]);
    let score = intersection.size / union.size;

    if (tok1.model && tok2.model && tok1.model === tok2.model) score += 0.2;

    return score;
  }

  getBrand(title) {
    if (!title) return null;
    const brands = ['apple', 'samsung', 'oneplus', 'google', 'xiaomi', 'redmi', 'realme', 'oppo', 'vivo', 'motorola', 'lenovo', 'hp', 'dell', 'asus', 'acer', 'nothing', 'sony', 'boat', 'noise', 'boult', 'reliance', 'spigen'];
    const lowerTitle = title.toLowerCase();
    for (const b of brands) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(lowerTitle)) {
        return b;
      }
    }
    return null;
  }

  getColor(title) {
    if (!title) return null;
    const match = title.match(COLOUR_WORDS);
    return match ? match[0].toLowerCase() : null;
  }

  getModelModifiers(title) {
    if (!title) return new Set();
    const lower = title.toLowerCase();
    const modifierList = ['pro', 'max', 'plus', 'mini', 'ultra', 'fe', 'lite', 'neo', 'play', 'active', 'zoom', 'fold', 'flip'];
    const modifiers = new Set();
    for (const m of modifierList) {
      if (new RegExp(`\\b${m}\\b`, 'i').test(lower)) {
        modifiers.add(m);
      }
    }
    return modifiers;
  }

  areSameElectronicsModel(titleA, titleB) {
    // 1. Brand match
    const brandA = this.getBrand(titleA);
    const brandB = this.getBrand(titleB);
    if (brandA && brandB && brandA !== brandB) {
      return false; // brand mismatch
    }

    // 2. Model modifier match
    const modsA = this.getModelModifiers(titleA);
    const modsB = this.getModelModifiers(titleB);
    if (modsA.size !== modsB.size || [...modsA].some(m => !modsB.has(m))) {
      return false; // model modifier mismatch
    }

    // 3. Storage/RAM mismatch
    const tokA = this.tokenize(this.normalizeString(titleA));
    const tokB = this.tokenize(this.normalizeString(titleB));
    if (tokA.storage !== tokB.storage) {
      return false;
    }
    if (tokA.ram !== tokB.ram) {
      return false;
    }

    // 4. Color mismatch
    const colorA = this.getColor(titleA);
    const colorB = this.getColor(titleB);
    if (colorA !== colorB) {
      return false;
    }

    return true;
  }

  isExactTokenMatch(product, query) {
    if (!query) return true;
    const normalizedQuery = query.toLowerCase().trim();
    const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0 && !STOP_WORDS.has(t));
    if (queryTokens.length === 0) return true;

    const titleLower = (product.title || '').toLowerCase();
    const pModel = (this.tokenize(this.normalizeString(product.title)).model || '').toLowerCase();

    return queryTokens.every(token => {
      if (titleLower.includes(token)) return true;
      if (pModel.includes(token)) return true;

      const cleanToken = token.replace(/[^\w]/g, '');
      if (cleanToken) {
        const cleanTitle = titleLower.replace(/[^\w]/g, '');
        const cleanModel = pModel.replace(/[^\w]/g, '');
        if (cleanTitle.includes(cleanToken) || cleanModel.includes(cleanToken)) {
          return true;
        }
      }
      return false;
    });
  }

  mergeProducts(rawProducts, originalQuery = '') {
    // ╔══════════════════════════════════════════════════════════════════════════╗
    // ║  DEBUG_RAW_MODE — Bypass ALL filtering, matching, grouping, merging.   ║
    // ║  Every scraped product is returned as its own individual card.          ║
    // ║  Set DEBUG_RAW_MODE=true in .env to enable.                            ║
    // ╚══════════════════════════════════════════════════════════════════════════╝
    if (process.env.DEBUG_RAW_MODE === 'true') {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`[DEBUG_RAW_MODE] ⚠️  ALL FILTERING/MATCHING/GROUPING BYPASSED`);
      console.log(`[DEBUG_RAW_MODE] Raw scraped products: ${rawProducts.length}`);
      console.log(`${'═'.repeat(70)}`);

      const rawCards = rawProducts.map((product, index) => {
        const primaryUrl = product.link || (product.stores && product.stores[0]?.url);
        const canonicalPlat = product.platform || (product.stores && product.stores[0]?.storeName);
        const stableId = generateStableId(primaryUrl, product.title, canonicalPlat);

        return {
          _id:        `${stableId}_raw_${index}`,
          baseName:   product.title || 'Untitled',
          brand:      product.brand || this.getBrand(product.title) || 'Unknown',
          category:   product.category || 'General',
          imageUrl:   product.image || null,
          lowestPrice: product.price || 0,
          rating:     product.rating || null,
          stores: [{
            storeName:     product.platform || 'Unknown',
            originalName:  product.title || 'Untitled',
            price:         product.price || 0,
            originalPrice: product.originalPrice || product.price || 0,
            discount:      (product.originalPrice && product.originalPrice > product.price)
                             ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                             : 0,
            url:           product.link || '',
            image:         product.image || null,
            inStock:       product.availability !== undefined ? product.availability : true,
            rating:        product.rating || null,
            reviews:       product.reviews || null,
          }],
        };
      });

      console.log(`[DEBUG_RAW_MODE] Products returned to frontend: ${rawCards.length}`);
      if (rawCards.length !== rawProducts.length) {
        console.error(`[DEBUG_RAW_MODE] ❌ MISMATCH! Raw=${rawProducts.length} Returned=${rawCards.length}`);
      } else {
        console.log(`[DEBUG_RAW_MODE] ✅ MATCH CONFIRMED: ${rawProducts.length} scraped → ${rawCards.length} returned`);
      }
      console.log(`${'═'.repeat(70)}\n`);

      return rawCards;
    }
    // ── END DEBUG_RAW_MODE ──────────────────────────────────────────────────────

    const mergedList  = [];
    const queryIntent = this.detectQueryIntent(originalQuery);
    const isFashion   = (queryIntent === 'fashion' || queryIntent === 'beauty');
    const category    = isFashion ? 'fashion' : (queryIntent === 'electronics' ? 'electronics' : 'general');

    if (process.env.DEBUG_MATCHING === 'true') console.log(`[MATCH] Query="${originalQuery}" Intent=${queryIntent} Category=${category} Raw=${rawProducts.length}`);

    // Lower similarity threshold from ~0.85 -> 0.65-0.75
    const threshold = isFashion ? 0.75 : 0.65;

    let requireExactColorMatch = false;
    let requireExactTypeMatch = false;
    if (category === 'fashion') {
      requireExactColorMatch = true;
      requireExactTypeMatch = true;
    }

    // Filter basic valid products (basic validation checks)
    const basicFiltered = [];
    for (const p of rawProducts) {
      if (!p.title || !p.price) {
        console.log(`[REMOVE] title="${p.title || 'N/A'}" retailer="${p.platform || p.source || 'N/A'}" price=${p.price || 0} reason="Missing title or price"`);
        continue;
      }
      if (this.isFashionBlacklisted(p.title)) {
        console.log(`[REMOVE] title="${p.title}" retailer="${p.platform || p.source}" price=${p.price} reason="Fashion blacklisted"`);
        continue;
      }
      if (originalQuery && this.isCrossCategoryContaminant(p, queryIntent)) {
        console.log(`[REMOVE] title="${p.title}" retailer="${p.platform || p.source}" price=${p.price} reason="Cross-category contaminant"`);
        continue;
      }
      if (queryIntent === 'electronics' && this.isAccessoryProduct(p.title)) {
        console.log(`[REMOVE] title="${p.title}" retailer="${p.platform || p.source}" price=${p.price} reason="Accessory mismatch"`);
        continue;
      }
      if (this.isAccessory(originalQuery, p.title)) {
        console.log(`[REMOVE] title="${p.title}" retailer="${p.platform || p.source}" price=${p.price} reason="Accessory blacklist mismatch"`);
        continue;
      }
      basicFiltered.push(p);
    }

    let candidateProducts = [];
    let isFuzzyFallback = false;
    let exactMatchCount = 0;

    // Tokenize query
    const normalizedQuery = originalQuery.toLowerCase().trim().replace(/\s+/g, ' ');
    const queryKey = normalizedQuery.replace(/\s+/g, '_');
    const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0 && !STOP_WORDS.has(t));

    if (queryTokens.length > 0) {
      const tier1Products = basicFiltered.filter(p => this.isExactTokenMatch(p, originalQuery));
      exactMatchCount = tier1Products.length;
      if (tier1Products.length > 0) {
        candidateProducts = tier1Products;
        isFuzzyFallback = false;
        
        // Log products filtered out in Tier 1
        const tier1Set = new Set(tier1Products);
        for (const p of basicFiltered) {
          if (!tier1Set.has(p)) {
            console.log(`[REMOVE] title="${p.title}" retailer="${p.platform || p.source}" price=${p.price} reason="Failed Tier 1 exact token match"`);
          }
        }

        if (process.env.DEBUG_MATCHING === 'true') {
          console.log(`[MATCH] Tier 1 Exact Matches found: ${tier1Products.length} items. Skipping fuzzy fallback.`);
        }
      } else {
        // Tier 2: Fuzzy matching fallback - filter by relevance first
        candidateProducts = basicFiltered.filter(p => {
          const relevant = originalQuery ? this.isRelevant(originalQuery, p.title) : true;
          if (!relevant) {
            console.log(`[REMOVE] title="${p.title}" retailer="${p.platform || p.source}" price=${p.price} reason="Failed Tier 2 relevance check"`);
          }
          return relevant;
        });
        isFuzzyFallback = true;
        
        // Log products filtered out in Tier 2
        const candidateSet = new Set(candidateProducts);
        for (const p of basicFiltered) {
          if (!candidateSet.has(p)) {
            console.log(`[REMOVE] title="${p.title}" retailer="${p.platform || p.source}" price=${p.price} reason="Failed Tier 2 relevance check"`);
          }
        }

        if (process.env.DEBUG_MATCHING === 'true') {
          console.log(`[MATCH] No Tier 1 Exact Matches found. Falling back to Tier 2 Fuzzy Matching.`);
        }
      }
    } else {
      candidateProducts = basicFiltered;
    }

    const scrapedCount = rawProducts.length;
    const finalCountEstimate = mergedList.length; // Will compute actual below
    const dedupedCount = scrapedCount - candidateProducts.length;

    console.log("normalizedQuery", normalizedQuery);
    console.log("queryKey", queryKey);
    console.log("matchedProductsCount", candidateProducts.length);
    console.log("rejectedProductsCount", rawProducts.length - candidateProducts.length);

    if (process.env.DEBUG_MATCHING === 'true') console.log(`[MATCH] After filtering: ${candidateProducts.length} valid products (rejected ${rawProducts.length - candidateProducts.length})`);

    // Sort: shorter titles first = more canonical base names
    const sortedRaw = [...candidateProducts].sort((a, b) => a.title.length - b.title.length);

    for (const product of sortedRaw) {
      let foundMatch = false;

      for (const merged of mergedList) {
        const score = this.calculateSimilarity(merged.baseName, product.title);
        const a = { title: merged.baseName };
        const b = { title: product.title };

        if (process.env.DEBUG_MATCHING === 'true') console.log(`[MATCH] "${a.title}" <-> "${b.title}" | score=${score.toFixed(3)}`);

        // Add hard guard: Different store platforms must NEVER merge unless similarity > 0.92 for fashion
        const platformA = merged.stores?.[0]?.storeName || merged.platform || '';
        const platformB = product.platform || '';

        if (
          platformA !== platformB &&
          category === 'fashion' &&
          score < 0.75
        ) {
          console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Different store platforms mismatch"`);
          if (process.env.DEBUG_MATCHING === 'true') console.log(`[REJECTED] "${a.title}" x "${b.title}" | reason=different platforms score=${score.toFixed(3)}`);
          if (process.env.DEBUG_MATCHING === 'true') console.log(`[NO MATCH] "${a.title}" x "${b.title}" | score=${score.toFixed(3)}`);
          continue;
        }

        // Brand and specs check for electronics/general
        if (category !== 'fashion') {
          const brandMatch = this.getBrand(merged.baseName) === this.getBrand(product.title) || !this.getBrand(merged.baseName) || !this.getBrand(product.title);
          const specsMatch = this.areSameElectronicsModel(merged.baseName, product.title);
          
          if (!brandMatch) {
            console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Brand mismatch (${this.getBrand(product.title)} vs ${this.getBrand(merged.baseName)})"`);
            continue;
          }
          if (!specsMatch) {
            console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Specs or variant mismatch"`);
            continue;
          }
        }

        if (score < threshold) {
          console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Below similarity threshold (${score.toFixed(3)} < ${threshold})"`);
          if (process.env.DEBUG_MATCHING === 'true') console.log(`[REJECTED] "${a.title}" x "${b.title}" | reason=below threshold (${score.toFixed(3)} < ${threshold})`);
          if (process.env.DEBUG_MATCHING === 'true') console.log(`[NO MATCH] "${a.title}" x "${b.title}" | score=${score.toFixed(3)}`);
          continue;
        }

        // STRICT FASHION RULES
        if (category === 'fashion') {
          // 1. Brands must match if known
          const brandA = (merged.brand || '').toLowerCase().trim();
          const brandB = (product.brand || '').toLowerCase().trim();
          if (brandA && brandB && brandA !== 'unknown' && brandB !== 'unknown' && brandA !== brandB) {
            console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Brand mismatch (${brandB} vs ${brandA})"`);
            if (process.env.DEBUG_MATCHING === 'true') console.log(`[REJECTED] "${a.title}" x "${b.title}" | reason=brand mismatch (${brandA} vs ${brandB})`);
            if (process.env.DEBUG_MATCHING === 'true') console.log(`[NO MATCH] "${a.title}" x "${b.title}" | score=${score.toFixed(3)}`);
            continue;
          }

          // 2. Exact color match
          if (requireExactColorMatch) {
            const colorA = (merged.baseName.match(COLOUR_WORDS) || [])[0]?.toLowerCase() || '';
            const colorB = (product.title.match(COLOUR_WORDS) || [])[0]?.toLowerCase() || '';
            if (colorA !== colorB) {
              console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Color mismatch (${colorB || 'none'} vs ${colorA || 'none'})"`);
              if (process.env.DEBUG_MATCHING === 'true') console.log(`[REJECTED] "${a.title}" x "${b.title}" | reason=color mismatch (${colorA || 'none'} vs ${colorB || 'none'})`);
              if (process.env.DEBUG_MATCHING === 'true') console.log(`[NO MATCH] "${a.title}" x "${b.title}" | score=${score.toFixed(3)}`);
              continue;
            }
          }

          // 3. Exact size match
          const sizeA = (merged.baseName.match(SIZE_WORDS) || [])[0]?.toLowerCase().replace(/\s/g, '') || '';
          const sizeB = (product.title.match(SIZE_WORDS) || [])[0]?.toLowerCase().replace(/\s/g, '') || '';
          if (sizeA !== sizeB) {
            console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Size mismatch (${sizeB || 'none'} vs ${sizeA || 'none'})"`);
            if (process.env.DEBUG_MATCHING === 'true') console.log(`[REJECTED] "${a.title}" x "${b.title}" | reason=size mismatch (${sizeA || 'none'} vs ${sizeB || 'none'})`);
            if (process.env.DEBUG_MATCHING === 'true') console.log(`[NO MATCH] "${a.title}" x "${b.title}" | score=${score.toFixed(3)}`);
            continue;
          }

          // 4. Exact product type match
          if (requireExactTypeMatch) {
            const TYPES = ['kurta set', 'kurta', 'kurti', 'dress', 'saree', 'sari', 'top', 'jeans', 'skirt', 'hoodie', 'jacket', 'shoe', 'heel', 'sandal', 'boot', 'sneaker', 'handbag', 'bag', 'wallet', 'lipstick', 'makeup', 'serum', 'moisturiser', 'moisturizer', 'foundation', 'kajal', 'kohl', 'mascara', 'eyeliner', 'blush', 'perfume', 'fragrance', 'deodorant', 'shampoo', 'conditioner', 't-shirt', 'tshirt', 'shirt'];
            let typeA = '';
            let typeB = '';
            const normA = merged.baseName.toLowerCase();
            const normB = product.title.toLowerCase();
            for (const t of TYPES) {
              if (normA.includes(t)) { typeA = t; break; }
            }
            for (const t of TYPES) {
              if (normB.includes(t)) { typeB = t; break; }
            }
            if (typeA !== typeB) {
              console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="Type mismatch (${typeB || 'none'} vs ${typeA || 'none'})"`);
              if (process.env.DEBUG_MATCHING === 'true') console.log(`[REJECTED] "${a.title}" x "${b.title}" | reason=product type mismatch (${typeA || 'none'} vs ${typeB || 'none'})`);
              if (process.env.DEBUG_MATCHING === 'true') console.log(`[NO MATCH] "${a.title}" x "${b.title}" | score=${score.toFixed(3)}`);
              continue;
            }
          }

          // 5. At least one common major title token
          const cleanTokens = (title, brand) => {
            let t = this.normalizeString(title);
            if (brand && brand !== 'unknown') {
              t = t.replace(new RegExp(`\\b${brand}\\b`, 'g'), ' ');
            }
            t = t.replace(COLOUR_WORDS, ' ');
            t = t.replace(SIZE_WORDS, ' ');
            t = t.replace(SHADE_WORDS, ' ');
            const words = t.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));
            return new Set(words);
          };

          const brandA2 = (merged.brand || '').toLowerCase().trim();
          const brandB2 = (product.brand || '').toLowerCase().trim();
          const tokensA = cleanTokens(merged.baseName, brandA2);
          const tokensB = cleanTokens(product.title, brandB2);
          const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
          if (tokensA.size > 0 && tokensB.size > 0 && intersection.size === 0) {
            console.log(`[MERGE-REJECT] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} reason="No major common tokens"`);
            if (process.env.DEBUG_MATCHING === 'true') console.log(`[REJECTED] "${a.title}" x "${b.title}" | reason=no common major title tokens`);
            if (process.env.DEBUG_MATCHING === 'true') console.log(`[NO MATCH] "${a.title}" x "${b.title}" | score=${score.toFixed(3)}`);
            continue;
          }
        }

        // Successfully merged!
        console.log(`[MERGE] source="${product.title}" target="${merged.baseName}" score=${score.toFixed(3)} key="${merged._id}"`);
        console.log(`[GROUP] cardId="${merged._id}" title="${product.title}" retailer="${product.platform || product.source}" groupingKey="${merged._id}"`);
        if (process.env.DEBUG_MATCHING === 'true') console.log(`[MERGED] "${a.title}" + "${b.title}" | score=${score.toFixed(3)}`);

        const existingStoreIdx = merged.stores.findIndex(s => s.storeName === product.platform);
        const storeEntry = {
          storeName:     product.platform,
          originalName:  product.title,
          price:         product.price,
          originalPrice: product.originalPrice || product.price,
          discount:      product.originalPrice > product.price
                           ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                           : 0,
          url:           product.link,
          image:         product.image || null,
          inStock:       true,
          rating:        product.rating || null,
        };

        if (existingStoreIdx >= 0) {
          if (product.price < merged.stores[existingStoreIdx].price)
            merged.stores[existingStoreIdx] = storeEntry;
        } else {
          merged.stores.push(storeEntry);
        }

        if (product.price < merged.lowestPrice) merged.lowestPrice = product.price;
        if (!merged.imageUrl && product.image)   merged.imageUrl    = product.image;
        foundMatch = true;
        break;
      }

      if (!foundMatch) {
        const primaryUrl = product.link || (product.stores && product.stores[0]?.url);
        const canonicalPlat = product.platform || (product.stores && product.stores[0]?.storeName);
        const stableId = generateStableId(primaryUrl, product.title, canonicalPlat);
        
        console.log(`[GROUP] cardId="${stableId}" title="${product.title}" retailer="${product.platform || product.source}" groupingKey="${stableId}"`);

        mergedList.push({
          _id:        stableId,
          baseName:   product.title,
          brand:      product.brand || this.getBrand(product.title) || 'Unknown',
          category:   product.category || (isFashion ? 'Fashion' : 'General'),
          imageUrl:   product.image || null,
          lowestPrice: product.price,
          rating:     product.rating || null,
          stores: [{
            storeName:     product.platform,
            originalName:  product.title,
            price:         product.price,
            originalPrice: product.originalPrice || product.price,
            discount:      product.originalPrice > product.price
                             ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                             : 0,
            url:           product.link,
            image:         product.image || null,
            inStock:       true,
            rating:        product.rating || null,
          }],
        });
      }
    }
    
    const finalCount = mergedList.length;
    const groupedCount = candidateProducts.length - finalCount;

    console.log("scrapedCount", scrapedCount);
    console.log("exactMatchCount", exactMatchCount);
    console.log("dedupedCount", dedupedCount);
    console.log("groupedCount", groupedCount);
    console.log("finalCount", finalCount);

    const filteredCount = scrapedCount - candidateProducts.length;
    console.log("productsFiltered", filteredCount);
    console.log(`[MATCH] scrapedCount: ${scrapedCount} | filteredCount: ${filteredCount} | finalCount: ${mergedList.length}`);

    console.log(`[MATCH] Final unique products: ${mergedList.length}`);
    return mergedList;
  }

  // ── Phase 12: Platform routing helper ────────────────────────────────────
  /**
   * Returns the set of platform names that should be activated for the
   * given query intent. Used by streamController to skip irrelevant scrapers.
   */
  getEnabledPlatforms(queryIntent) {
    switch (queryIntent) {
      case 'electronics':
        return new Set(['Amazon', 'Flipkart', 'Reliance Digital']);

      case 'fashion':
      case 'beauty':
        return new Set(['AJIO', 'Myntra', 'Nykaa', 'Amazon', 'Flipkart']);

      case 'accessories':
        // All platforms allowed for accessory queries
        return new Set(['Amazon', 'Flipkart', 'Reliance Digital', 'AJIO', 'Nykaa', 'Myntra']);

      default:
        // General — all platforms
        return new Set(['Amazon', 'Flipkart', 'Reliance Digital', 'AJIO', 'Nykaa', 'Myntra']);
    }
  }
}

module.exports = new MatchingService();
