/**
 * Query Classifier
 * Detects search intent: fashion | beauty | electronics | general
 * Used by streamController to reorder platform priority per query type.
 */

const FASHION_TERMS = new Set([
  'kurti', 'kurta', 'saree', 'sari', 'salwar', 'lehenga', 'dupatta',
  'dress', 'dresses', 'gown', 'top', 'tops', 'blouse', 'tunic',
  'jeans', 'trousers', 'pants', 'skirt', 'shorts',
  'hoodie', 'sweatshirt', 'jacket', 'coat', 'sweater', 'cardigan',
  'tshirt', 't-shirt', 'shirt', 'polo',
  'heels', 'sandal', 'sandals', 'boot', 'boots', 'footwear', 'sneaker', 'sneakers',
  'handbag', 'handbags', 'purse', 'clutch', 'bag', 'tote', 'backpack',
  'scarf', 'stole', 'shawl', 'dupatta',
  'jewellery', 'jewelry', 'necklace', 'earring', 'bracelet', 'bangle', 'ring',
  'watch', 'sunglasses', 'belt', 'wallet',
  'ethnic', 'western', 'casual', 'formal', 'party wear',
  "women's fashion", "women fashion", 'ladies wear',
  'men fashion', 'menswear',
]);

const BEAUTY_TERMS = new Set([
  'lipstick', 'lip gloss', 'lip liner', 'lip balm', 'lip',
  'foundation', 'concealer', 'primer', 'blush', 'bronzer', 'highlighter',
  'eyeshadow', 'mascara', 'eyeliner', 'kajal', 'kohl', 'eye liner',
  'skincare', 'skin care', 'moisturizer', 'moisturiser', 'sunscreen', 'spf',
  'serum', 'toner', 'face wash', 'cleanser', 'exfoliant', 'scrub',
  'face mask', 'sheet mask', 'eye cream', 'night cream', 'day cream',
  'perfume', 'fragrance', 'deodorant', 'body mist',
  'shampoo', 'conditioner', 'hair oil', 'hair serum', 'hair mask',
  'nail polish', 'nail paint', 'nail colour',
  'makeup', 'cosmetic', 'cosmetics', 'beauty',
]);

const ELECTRONICS_TERMS = new Set([
  'iphone', 'samsung', 'oneplus', 'realme', 'redmi', 'pixel', 'motorola',
  'smartphone', 'mobile', 'phone',
  'laptop', 'macbook', 'chromebook', 'notebook',
  'tablet', 'ipad',
  'earbuds', 'airpods', 'headphones', 'earphones',
  'smartwatch', 'fitness band',
  'tv', 'oled', 'qled', 'television',
  'speaker', 'bluetooth speaker', 'soundbar',
  'camera', 'dslr', 'mirrorless',
  'charger', 'powerbank', 'power bank', 'cable',
  'router', 'wifi', 'keyboard', 'mouse',
  'refrigerator', 'washing machine', 'air conditioner', 'microwave',
]);

/**
 * Classify a search query.
 * @returns {'fashion' | 'beauty' | 'electronics' | 'general'}
 */
function classifyQuery(query) {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/);

  // Check each token AND the full phrase
  const allPhrases = [q, ...tokens];

  for (const phrase of allPhrases) {
    if (BEAUTY_TERMS.has(phrase))      return 'beauty';
  }
  for (const phrase of allPhrases) {
    if (FASHION_TERMS.has(phrase))     return 'fashion';
  }
  for (const phrase of allPhrases) {
    if (ELECTRONICS_TERMS.has(phrase)) return 'electronics';
  }

  // Substring fallback for compound words (e.g. "skincare" → "skin")
  if (/skincare|lipstick|sunscreen|serum|moistur|foundation|mascara|eyeliner|kajal|perfume|fragrance|deodor|shampoo|conditioner/i.test(q)) return 'beauty';
  if (/saree|kurti|kurta|salwar|lehenga|dupatta|jeans|dress|gown|hoodie|sneaker|handbag|footwear|heels/i.test(q))                          return 'fashion';
  if (/iphone|samsung|macbook|airpod|earbuds|laptop|tablet|smartphone|smartwatch|bluetooth/i.test(q))                                       return 'electronics';

  return 'general';
}

module.exports = { classifyQuery };
