const mongoose = require('mongoose');
const User = require('./src/models/User');
const Product = require('./src/models/product');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        let user = await User.findOne({});
        if (!user) {
            console.log('No user found, creating test user...');
            user = new User({ name: 'Test User', email: 'test@example.com', password: 'password123' });
            await user.save();
        }
        
        console.log('User favorites:', user.favorites);
        console.log('User viewHistory:', user.viewHistory);
        console.log('User alerts:', user.alerts);
        
        // Let's check products
        const products = await Product.find({}).limit(2);
        console.log(`Found ${products.length} products`);
        if (products.length > 0) {
            const prod = products[0];
            console.log('Test product ID:', prod._id.toString());
            
            // Try to toggle wishlist
            const idx = user.favorites.findIndex(id => id.toString() === prod._id.toString());
            if (idx > -1) {
                user.favorites.splice(idx, 1);
            } else {
                user.favorites.push(prod._id);
            }
            await user.save();
            console.log('Successfully updated user wishlist');
            
            // Try to get recommendations
            await user.populate('viewHistory');
            const viewedCategories = user.viewHistory.map(p => p.category).filter(Boolean);
            const uniqueCategories = [...new Set(viewedCategories)];
            console.log('Categories:', uniqueCategories);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
