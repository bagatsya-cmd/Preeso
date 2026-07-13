const mongoose = require('mongoose');
const User = require('./src/models/User');
const Product = require('./src/models/product');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({});
        if (!user) return console.log('No user');
        
        console.log('Populating viewHistory...', user.viewHistory);
        await user.populate('viewHistory');
        
        console.log('viewHistory after populate:', user.viewHistory.map(p => p ? p.name : 'NULL_DOC'));
        
        const viewedCategories = user.viewHistory.map(p => p.category).filter(Boolean);
        console.log('Categories:', viewedCategories);
        
    } catch (e) {
        console.error('Error during recommendations logic:', e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
