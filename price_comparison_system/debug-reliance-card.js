const browserManager = require('./backend/src/utils/browserManager');

async function check() {
  const url = 'https://www.reliancedigital.in/products?q=iphone';
  console.log(`Navigating to: ${url}`);
  const page = await browserManager.getPage(null, true);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('a.details-container', { timeout: 10000 });

    const cardHtml = await page.evaluate(() => {
      const anchor = document.querySelector('a.details-container');
      if (anchor) {
        const parent = anchor.parentElement;
        const grandparent = parent ? parent.parentElement : null;
        return grandparent ? grandparent.outerHTML : 'no grandparent';
      }
      return 'no details-container';
    });

    console.log('--- Parent HTML ---');
    console.log(cardHtml);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await page.close();
    await browserManager.closeBrowser();
  }
}

check();
