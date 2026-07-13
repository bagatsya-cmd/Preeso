const browserManager = require('./backend/src/utils/browserManager');

async function checkApi() {
  const url = 'https://www.reliancedigital.in/products?q=iphone%2015%20cover';
  console.log(`Navigating to: ${url}`);
  const page = await browserManager.getPage(null, true); // skipInterception = true

  let apiJson = null;

  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/ext/raven-api/catalog/v1.0/products')) {
      console.log(`[Captured API Response] URL: ${u}`);
      try {
        apiJson = await res.json();
      } catch (err) {
        console.error('Failed to parse API JSON:', err.message);
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 6000)); // wait to ensure API finishes loading

    if (apiJson) {
      console.log('--- API Response JSON Keys ---');
      console.log(Object.keys(apiJson));
      if (apiJson.items) {
        console.log(`Items length: ${apiJson.items.length}`);
        console.log('First item sample:');
        console.log(JSON.stringify(apiJson.items[0], null, 2));
      }
    } else {
      console.log('API response not captured.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await page.close();
    await browserManager.closeBrowser();
  }
}

checkApi();
