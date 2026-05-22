/**
 * Standalone diagnostic runner for AJIO and Nykaa scrapers.
 * Run:  node test-fashion-scrapers.js
 * Output: console logs + ajio-debug.html/png + nykaa-debug.html/png in project root
 */

const ajio  = require('./backend/src/scrapers/ajio');
const nykaa = require('./backend/src/scrapers/nykaa');

async function run() {
  console.log('='.repeat(60));
  console.log('FASHION SCRAPER DIAGNOSTIC');
  console.log('='.repeat(60));

  // Test 1: AJIO — kurti
  console.log('\n[TEST 1] AJIO kurti');
  const ajioResults = await ajio.search('kurti').catch(e => {
    console.error('[AJIO] Test failed:', e.message);
    return [];
  });
  console.log(`[TEST 1] RESULT: ${ajioResults.length} products`);

  // Test 2: Nykaa — lipstick
  console.log('\n[TEST 2] Nykaa lipstick');
  const nykaaResults = await nykaa.search('lipstick').catch(e => {
    console.error('[Nykaa] Test failed:', e.message);
    return [];
  });
  console.log(`[TEST 2] RESULT: ${nykaaResults.length} products`);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log(`  AJIO  kurti:    ${ajioResults.length} products`);
  console.log(`  Nykaa lipstick: ${nykaaResults.length} products`);
  console.log('='.repeat(60));
  console.log('\nCheck these files for DOM inspection:');
  console.log('  ajio-debug.html   ajio-debug.png');
  console.log('  nykaa-debug.html  nykaa-debug.png');

  process.exit(0);
}

run().catch(e => { console.error('Runner error:', e); process.exit(1); });
