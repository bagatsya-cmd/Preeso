const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ScrapedProduct = require('./src/models/scrapedProduct');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");
    
    // Drop the old index
    await mongoose.connection.collection('scrapedproducts').dropIndex('uniqueHash_1');
    console.log("Dropped uniqueHash_1 index.");
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log("Index uniqueHash_1 already dropped or doesn't exist.");
    } else {
      console.error(err);
    }
  }
  
  try {
    // Ensure new indexes are built
    await ScrapedProduct.syncIndexes();
    console.log("Indexes synced.");
  } catch(err) {
    console.error(err);
  }

  process.exit(0);
}

run();
