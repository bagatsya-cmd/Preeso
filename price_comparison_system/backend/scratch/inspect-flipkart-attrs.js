/**
 * Diagnostic: Inspect ALL image attributes on Flipkart product cards.
 * Goal: Find exactly which attribute holds the real product image.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navigating to Flipkart search for "iphone 15"...');
  await page.goto('https://www.flipkart.com/search?q=iphone+15', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  // Wait for product containers
  await page.waitForSelector('div[data-id]', { timeout: 10000 }).catch(() => console.log('Container selector timeout'));

  // PHASE 1: Check images BEFORE scrolling
  console.log('\n========== BEFORE SCROLL ==========');
  const beforeScroll = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[data-id]')).slice(0, 3);
    return cards.map((card, i) => {
      const imgs = Array.from(card.querySelectorAll('img'));
      return imgs.map(img => {
        const attrs = {};
        for (const attr of img.attributes) {
          attrs[attr.name] = attr.value.substring(0, 150);
        }
        return { cardIndex: i, tagName: img.tagName, attrs };
      });
    });
  });
  console.log(JSON.stringify(beforeScroll, null, 2));

  // PHASE 2: Scroll aggressively
  console.log('\n========== SCROLLING... ==========');
  await page.evaluate(async () => {
    for (let i = 0; i < 15; i++) {
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 300));
    }
    // Scroll back to top
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
    // Scroll down slowly again
    for (let i = 0; i < 15; i++) {
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 300));
    }
  });

  // Wait for images to load after scroll
  await new Promise(r => setTimeout(r, 3000));

  // PHASE 3: Check images AFTER scrolling
  console.log('\n========== AFTER SCROLL ==========');
  const afterScroll = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[data-id]')).slice(0, 5);
    return cards.map((card, i) => {
      const imgs = Array.from(card.querySelectorAll('img'));
      const result = { cardIndex: i };
      
      // Get title
      const linkEl = card.querySelector('a.atJtCj, a.CGtC98, a._1fQZEK, a.IRpwTa, a.WKTcLC, a._2mylwZ, a');
      result.title = linkEl ? (linkEl.getAttribute('title') || linkEl.innerText.trim()).substring(0, 60) : 'N/A';
      
      result.images = imgs.map(img => {
        const data = {
          src: img.src ? img.src.substring(0, 200) : null,
          'data-src': img.getAttribute('data-src') ? img.getAttribute('data-src').substring(0, 200) : null,
          'data-lazy-src': img.getAttribute('data-lazy-src') ? img.getAttribute('data-lazy-src').substring(0, 200) : null,
          'data-srcset': img.getAttribute('data-srcset') ? img.getAttribute('data-srcset').substring(0, 200) : null,
          srcset: img.getAttribute('srcset') ? img.getAttribute('srcset').substring(0, 200) : null,
          'data-original': img.getAttribute('data-original') ? img.getAttribute('data-original').substring(0, 200) : null,
          alt: img.getAttribute('alt') ? img.getAttribute('alt').substring(0, 60) : null,
          class: img.className || null,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
        
        // Also dump ALL attributes
        const allAttrs = {};
        for (const attr of img.attributes) {
          if (!['src', 'alt', 'class', 'style', 'width', 'height'].includes(attr.name)) {
            allAttrs[attr.name] = attr.value.substring(0, 200);
          }
        }
        data.otherAttrs = allAttrs;
        
        return data;
      });
      
      // Check for picture > source elements
      const pictures = card.querySelectorAll('picture');
      if (pictures.length > 0) {
        result.pictureElements = Array.from(pictures).map(pic => {
          const sources = Array.from(pic.querySelectorAll('source'));
          return sources.map(s => ({
            srcset: s.getAttribute('srcset')?.substring(0, 200),
            'data-srcset': s.getAttribute('data-srcset')?.substring(0, 200),
            type: s.getAttribute('type'),
            media: s.getAttribute('media'),
          }));
        });
      }

      // Check for background images on divs
      const divsWithBg = [];
      const allEls = card.querySelectorAll('*');
      for (const el of allEls) {
        const bg = el.style?.backgroundImage;
        if (bg && bg !== 'none' && bg !== '') {
          divsWithBg.push({ tag: el.tagName, class: el.className?.substring?.(0, 50), bg: bg.substring(0, 200) });
        }
      }
      if (divsWithBg.length > 0) result.backgroundImages = divsWithBg;
      
      return result;
    });
  });
  
  for (const card of afterScroll) {
    console.log(`\n--- Card ${card.cardIndex}: ${card.title} ---`);
    for (const img of card.images) {
      console.log('  src:', img.src);
      console.log('  data-src:', img['data-src']);
      console.log('  data-lazy-src:', img['data-lazy-src']);
      console.log('  srcset:', img.srcset);
      console.log('  data-srcset:', img['data-srcset']);
      console.log('  data-original:', img['data-original']);
      console.log('  alt:', img.alt);
      console.log('  class:', img.class);
      console.log('  naturalWidth:', img.naturalWidth, 'naturalHeight:', img.naturalHeight);
      console.log('  otherAttrs:', JSON.stringify(img.otherAttrs));
    }
    if (card.pictureElements) console.log('  PICTURE elements:', JSON.stringify(card.pictureElements));
    if (card.backgroundImages) console.log('  BG images:', JSON.stringify(card.backgroundImages));
  }

  // PHASE 4: Check if there's a waitForSelector that would work for real images
  console.log('\n========== IMAGE URL ANALYSIS ==========');
  const urlAnalysis = await page.evaluate(() => {
    const allImgs = Array.from(document.querySelectorAll('div[data-id] img'));
    const urls = allImgs.map(img => img.src).filter(Boolean);
    const placeholders = urls.filter(u => u.includes('placeholder'));
    const real = urls.filter(u => !u.includes('placeholder') && u.startsWith('http'));
    return {
      total: urls.length,
      placeholders: placeholders.length,
      real: real.length,
      sampleReal: real.slice(0, 5),
      samplePlaceholder: placeholders.slice(0, 2),
      realContains: real.length > 0 ? {
        hasRukminim: real.some(u => u.includes('rukminim')),
        hasFkimg: real.some(u => u.includes('fkimg')),
        hasFlixcart: real.some(u => u.includes('flixcart')),
      } : 'no real images found'
    };
  });
  console.log(JSON.stringify(urlAnalysis, null, 2));

  await browser.close();
  console.log('\nDone.');
  process.exit(0);
})();
