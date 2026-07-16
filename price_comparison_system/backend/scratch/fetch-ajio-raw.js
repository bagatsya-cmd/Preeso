const axios = require('axios');
const fs = require('fs');

(async () => {
  console.log('Fetching AJIO search raw HTML...');
  try {
    const response = await axios.get('https://www.ajio.com/search/?text=shoes', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    console.log('Status Code:', response.status);
    console.log('Content Length:', response.data.length);
    fs.writeFileSync('scratch/ajio_raw.html', response.data);
    console.log('Saved raw HTML to scratch/ajio_raw.html');

    // Check if there are any window or state variables in the HTML
    const matches = response.data.match(/__\w+__/g);
    console.log('Matches with __WORD__:', [...new Set(matches)]);
  } catch (err) {
    console.log('Error fetching AJIO:', err.message);
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response snippet:', err.response.data.substring(0, 500));
    }
  }
})();
