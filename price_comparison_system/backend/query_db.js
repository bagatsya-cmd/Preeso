const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const ScrapedProduct = require("./src/models/scrapedProduct");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const queryKey = "laptop";

  const total = await ScrapedProduct.countDocuments({ queryKey });
  console.log(`Total products for ${queryKey}:`, total);

  const stats = await ScrapedProduct.aggregate([
    { $match: { queryKey } },
    { $group: { 
        _id: { source: "$source", date: { $dateToString: { format: "%Y-%m-%d %H", date: "$scrapedAt" } } },
        count: { $sum: 1 },
        uniqueTitles: { $addToSet: "$title" }
      }
    },
    { $sort: { "_id.date": -1, "_id.source": 1 } }
  ]);

  console.log("Aggregation by retailer and hour:");
  stats.forEach(s => {
    console.log(`Retailer: ${s._id.source}, Date: ${s._id.date}, Count: ${s.count}, Unique Titles: ${s.uniqueTitles.length}`);
  });

  const duplicates = await ScrapedProduct.aggregate([
    { $match: { queryKey } },
    { $group: {
        _id: { title: "$title", source: "$source" },
        count: { $sum: 1 },
        prices: { $addToSet: "$price" },
        hashes: { $addToSet: "$uniqueHash" }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log(`\nFound ${duplicates.length} products with multiple price/hash entries.`);
  if (duplicates.length > 0) {
    console.log("Sample duplicates:");
    console.dir(duplicates.slice(0, 3), { depth: null });
  }

  process.exit(0);
}

run().catch(console.error);
