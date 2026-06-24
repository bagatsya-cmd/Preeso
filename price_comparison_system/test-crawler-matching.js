const assert = require('assert');
const matchingService = require('./backend/src/services/matchingService');

// Stub environment variable to enable matching prints if needed
process.env.DEBUG_MATCHING = 'true';

async function runTests() {
  console.log('=== RUNNING MATCHING SERVICE TEST SUITE ===\n');

  // Test Case 1: Strict Exact Token Match for "iphone 15"
  console.log('--- Test Case 1: iphone 15 (should NOT match iphone 14 or accessories) ---');
  const mockProducts1 = [
    { title: 'Apple iPhone 15 128GB Black', price: 65000, platform: 'Flipkart', link: 'http://f.com/ip15' },
    { title: 'Apple iPhone 15 Pro Max 256GB', price: 120000, platform: 'Amazon', link: 'http://a.com/ip15pro' },
    { title: 'Apple iPhone 14 128GB Blue', price: 55000, platform: 'Flipkart', link: 'http://f.com/ip14' },
    { title: 'iPhone 15 Case / Clear Silicone Cover', price: 999, platform: 'Amazon', link: 'http://a.com/case' },
    { title: 'Fast Charger for iPhone 15 20W USB-C', price: 1499, platform: 'Reliance Digital', link: 'http://r.com/charger' }
  ];

  const results1 = matchingService.mergeProducts(mockProducts1, 'iphone 15');
  console.log('Results 1:', results1.map(r => r.baseName));
  
  // Assertions
  assert.ok(results1.some(r => r.baseName.includes('iPhone 15')), 'Should contain iPhone 15');
  assert.ok(!results1.some(r => r.baseName.includes('iPhone 14')), 'Should NOT contain iPhone 14 (strict match active)');
  assert.ok(!results1.some(r => r.baseName.includes('Case') || r.baseName.includes('Cover')), 'Should NOT contain Case/Cover accessory');
  assert.ok(!results1.some(r => r.baseName.includes('Charger')), 'Should NOT contain Charger accessory');

  // Test Case 2: Tier 1 match exists (should skip fuzzy fallback and only return exact)
  console.log('\n--- Test Case 2: iphone 15 exact exists (should NOT fallback to fuzzy other models) ---');
  const mockProducts2 = [
    { title: 'Apple iPhone 15 128GB Black', price: 65000, platform: 'Flipkart', link: 'http://f.com/ip15' },
    { title: 'Apple iPhone 14 128GB Blue', price: 55000, platform: 'Flipkart', link: 'http://f.com/ip14' }
  ];

  const results2 = matchingService.mergeProducts(mockProducts2, 'iphone 15');
  console.log('Results 2:', results2.map(r => r.baseName));
  assert.strictEqual(results2.length, 1, 'Should return only the exact iPhone 15 product');
  assert.ok(results2[0].baseName.includes('iPhone 15'), 'Should be iPhone 15');

  // Test Case 3: Fuzzy Fallback when zero exact matches exist
  console.log('\n--- Test Case 3: Fuzzy Fallback when zero exact matches ---');
  const mockProducts3 = [
    { title: 'Mechanical Keyboard RGB Light', price: 2500, platform: 'Amazon', link: 'http://a.com/kb' }
  ];
  
  // Searching for "wireless mechanical keyboard rgb" (fails Tier 1 since "wireless" is missing, but matches Tier 2 fuzzy)
  const results3 = matchingService.mergeProducts(mockProducts3, 'wireless mechanical keyboard rgb');
  console.log('Results 3:', results3.map(r => r.baseName));
  assert.strictEqual(results3.length, 1, 'Should find 1 match via fuzzy fallback');
  assert.ok(results3[0].baseName.includes('Mechanical Keyboard'), 'Should match Mechanical Keyboard');

  console.log('\n✅ ALL TEST CASES PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
