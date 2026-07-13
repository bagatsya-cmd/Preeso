const browserManager = require('./backend/src/utils/browserManager');

async function checkNykaaFashionJson() {
  const url = 'https://www.nykaa.com/search/result/?q=saree&ptype=search&id=0';
  console.log(`Navigating to: ${url}`);
  
  // Use same headers as actual scraper to bypass block
  const page = await browserManager.getPage(null);
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-site': 'none',
    'sec-fetch-mode': 'navigate',
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const finalUrl = page.url();
    const pageTitle = await page.title();
    console.log(`Final URL: ${finalUrl}`);
    console.log(`Page Title: "${pageTitle}"`);

    const result = await page.evaluate(() => {
      const stateKeys = [];
      if (window.__INITIAL_STATE__) stateKeys.push('__INITIAL_STATE__');
      if (window.__NEXT_DATA__) stateKeys.push('__NEXT_DATA__');
      
      let sampleData = null;
      if (window.__INITIAL_STATE__) {
        sampleData = JSON.stringify(window.__INITIAL_STATE__).substring(0, 1500);
      }
      return { stateKeys, sampleData };
    });

    console.log('Detected state variables in window:', result.stateKeys);
    if (result.sampleData) {
      console.log('Sample Data (1500 chars):');
      console.log(result.sampleData);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await page.close();
    await browserManager.closeBrowser();
  }
}

checkNykaaFashionJson();
