const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = path.join(__dirname, '..', '..', 'debug-snapshots');

function run() {
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.startsWith('flipkart-run3'));
  if (files.length === 0) {
    console.log('No Flipkart snapshot files found');
    return;
  }

  const filePath = path.join(SNAPSHOT_DIR, files[0]);
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`File size: ${content.length} characters`);

  const rukminimMatches = content.match(/rukminim\d*[\w./\-]+/gi) || [];
  console.log(`Found ${rukminimMatches.length} occurrences of "rukminim"`);

  const imgUrlRegex = /(https?:)?\/\/[\w.\/\-]+\.(jpg|jpeg|png|webp)/gi;
  const allUrls = content.match(imgUrlRegex) || [];
  console.log(`Found ${allUrls.length} total image URLs (ending in jpg, jpeg, png, webp)`);
  
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`Unique URLs: ${uniqueUrls.length}`);
  
  const nonPlaceholders = uniqueUrls.filter(u => !u.includes('placeholder') && !u.includes('plus_') && !u.includes('fa_'));
  console.log(`Unique non-placeholder URLs: ${nonPlaceholders.length}`);
  console.log('First 15 non-placeholder image URLs:');
  console.log(nonPlaceholders.slice(0, 15));
}

run();
