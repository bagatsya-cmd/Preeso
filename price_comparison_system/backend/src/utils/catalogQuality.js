/**
 * catalogQuality.js
 * 
 * Computes a quality score (0 to 100) for a scraped product.
 * Flags products with low quality scores.
 */

function scoreProduct(product) {
  let score = 0;

  // 1. Image present (+40)
  if (product.image && typeof product.image === 'string' && product.image.trim().startsWith('http')) {
    score += 40;
  }

  // 2. Price present (+20)
  if (product.price !== undefined && product.price !== null && typeof product.price === 'number' && product.price > 0) {
    score += 20;
  }

  // 3. Title present (+20)
  if (product.title && typeof product.title === 'string' && product.title.trim().length >= 3) {
    score += 20;
  }

  // 4. Product URL present (+10)
  if (product.link && typeof product.link === 'string' && product.link.trim().startsWith('http')) {
    score += 10;
  } else if (product.url && typeof product.url === 'string' && product.url.trim().startsWith('http')) {
    score += 10;
  }

  // 5. Brand detected (+10)
  if (product.brand && typeof product.brand === 'string' && product.brand.trim() !== '' && product.brand.toLowerCase() !== 'unknown') {
    score += 10;
  }

  return score;
}

module.exports = {
  scoreProduct
};
