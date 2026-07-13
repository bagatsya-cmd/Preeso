require('dotenv').config();
const fs = require('fs');
const { searchAllPlatforms } = require('./src/services/scraper');

async function test() {
    const queries = ['iphone 15', 'sony headphones'];
    const allResults = {};
    for (const q of queries) {
        console.log(`Testing query: ${q}...`);
        const results = await searchAllPlatforms(q);
        allResults[q] = results ? results.slice(0, 2) : []; // take 2 items
    }
    fs.writeFileSync('test_output.json', JSON.stringify(allResults, null, 2), 'utf8');
    console.log('Done.');
}
test();
