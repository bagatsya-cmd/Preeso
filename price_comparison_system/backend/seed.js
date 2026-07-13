require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/product');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/price_comparison';

function genHistory(storeName, currentPrice, days = 30) {
    const history = [];
    let price = currentPrice * 1.1;
    for (let i = days; i >= 0; i--) {
        price = price + (Math.random() - 0.47) * currentPrice * 0.025;
        price = Math.max(currentPrice * 0.88, Math.min(price, currentPrice * 1.2));
        history.push({ date: new Date(Date.now() - i * 86400000), price: Math.round(price), storeName });
    }
    history[history.length - 1].price = currentPrice;
    return history;
}

const PRODUCTS = [
    {
        name: 'Apple iPhone 15 (128GB, Black)', brand: 'Apple', category: 'Smartphones', searchQuery: 'iphone 15',
        image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600',
        description: 'Apple iPhone 15 with A16 Bionic chip, 48MP camera, Dynamic Island, and USB-C charging.',
        tags: ['iphone', 'apple', 'smartphone', '5g'],
        stores: [
            { storeName: 'Amazon', price: 69999, originalPrice: 79900, discount: 12, rating: 4.5, reviewCount: 3420, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=iphone+15', inStock: true },
            { storeName: 'Flipkart', price: 71499, originalPrice: 79900, discount: 10, rating: 4.4, reviewCount: 2870, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=iphone+15', inStock: true },
            { storeName: 'Reliance Digital', price: 72999, originalPrice: 79900, discount: 8, rating: 4.3, reviewCount: 980, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=iphone+15', inStock: true }
        ]
    },
    {
        name: 'Apple iPhone 15 Pro Max (256GB, Natural Titanium)', brand: 'Apple', category: 'Smartphones', searchQuery: 'iphone 15 pro max',
        image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600',
        description: 'Apple iPhone 15 Pro Max with A17 Pro chip, 48MP triple camera system, USB-C with USB 3 speeds, and Titanium finish.',
        tags: ['iphone', 'apple', 'pro', 'smartphone'],
        stores: [
            { storeName: 'Amazon', price: 134999, originalPrice: 159900, discount: 15, rating: 4.7, reviewCount: 5120, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=iphone+15+pro+max', inStock: true },
            { storeName: 'Flipkart', price: 133499, originalPrice: 159900, discount: 16, rating: 4.6, reviewCount: 4210, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=iphone+15+pro+max', inStock: true },
            { storeName: 'Reliance Digital', price: 136999, originalPrice: 159900, discount: 14, rating: 4.5, reviewCount: 1890, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=iphone+15+pro+max', inStock: true }
        ]
    },
    {
        name: 'Samsung Galaxy S24 Ultra (256GB, Titanium Black)', brand: 'Samsung', category: 'Smartphones', searchQuery: 'samsung s24 ultra',
        image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600',
        description: 'Samsung Galaxy S24 Ultra with Snapdragon 8 Gen 3, 200MP camera, S Pen, and 12GB RAM.',
        tags: ['samsung', 'galaxy', 'android', 'smartphone', 's24'],
        stores: [
            { storeName: 'Amazon', price: 109999, originalPrice: 129999, discount: 15, rating: 4.6, reviewCount: 4120, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=samsung+s24+ultra', inStock: true },
            { storeName: 'Flipkart', price: 107499, originalPrice: 129999, discount: 17, rating: 4.5, reviewCount: 3680, delivery: 'Free, Next Day', deliveryDays: 1, link: 'https://www.flipkart.com/search?q=samsung+s24+ultra', inStock: true },
            { storeName: 'Reliance Digital', price: 111999, originalPrice: 129999, discount: 13, rating: 4.4, reviewCount: 1120, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=samsung+s24+ultra', inStock: true }
        ]
    },
    {
        name: 'OnePlus 12 (256GB, Silky Black)', brand: 'OnePlus', category: 'Smartphones', searchQuery: 'oneplus 12',
        image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600',
        description: 'OnePlus 12 with Snapdragon 8 Gen 3, 50MP Hasselblad camera, 100W SuperVOOC charging, and 16GB RAM.',
        tags: ['oneplus', 'android', 'smartphone', '5g'],
        stores: [
            { storeName: 'Amazon', price: 64999, originalPrice: 69999, discount: 7, rating: 4.5, reviewCount: 3210, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=oneplus+12', inStock: true },
            { storeName: 'Flipkart', price: 63999, originalPrice: 69999, discount: 8, rating: 4.4, reviewCount: 2780, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=oneplus+12', inStock: true }
        ]
    },
    {
        name: 'Apple MacBook Air M2 (8GB/512GB, Midnight)', brand: 'Apple', category: 'Laptops', searchQuery: 'macbook air m2',
        image: 'https://images.unsplash.com/photo-1611186871525-5f5daaeba28c?w=600',
        description: 'MacBook Air with M2 chip, 13.6-inch Liquid Retina display, 18-hour battery, and fanless design.',
        tags: ['macbook', 'apple', 'laptop', 'm2'],
        stores: [
            { storeName: 'Amazon', price: 94990, originalPrice: 114900, discount: 17, rating: 4.8, reviewCount: 7210, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=macbook+air+m2', inStock: true },
            { storeName: 'Flipkart', price: 92999, originalPrice: 114900, discount: 19, rating: 4.7, reviewCount: 5840, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=macbook+air+m2', inStock: true },
            { storeName: 'Reliance Digital', price: 97999, originalPrice: 114900, discount: 14, rating: 4.6, reviewCount: 2100, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=macbook+air+m2', inStock: true }
        ]
    },
    {
        name: 'Dell XPS 15 (Intel i7-13700H, 16GB/512GB, RTX 4060)', brand: 'Dell', category: 'Laptops', searchQuery: 'dell xps 15',
        image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600',
        description: 'Dell XPS 15 with 13th-gen Intel Core i7, NVIDIA RTX 4060, 15.6" OLED display, and 86Wh battery.',
        tags: ['dell', 'xps', 'laptop', 'gaming', 'rtx'],
        stores: [
            { storeName: 'Amazon', price: 129999, originalPrice: 154900, discount: 16, rating: 4.5, reviewCount: 2340, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.amazon.in/s?k=dell+xps+15', inStock: true },
            { storeName: 'Flipkart', price: 127499, originalPrice: 154900, discount: 17, rating: 4.4, reviewCount: 1890, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=dell+xps+15', inStock: true }
        ]
    },
    {
        name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', brand: 'Sony', category: 'Audio', searchQuery: 'sony wh-1000xm5',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
        description: 'Sony WH-1000XM5 with industry-leading ANC, 30-hour battery, multipoint connection, and Hi-Res Audio.',
        tags: ['sony', 'headphones', 'anc', 'wireless', 'audio'],
        stores: [
            { storeName: 'Amazon', price: 24990, originalPrice: 34990, discount: 28, rating: 4.7, reviewCount: 12430, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=sony+wh1000xm5', inStock: true },
            { storeName: 'Flipkart', price: 23999, originalPrice: 34990, discount: 31, rating: 4.6, reviewCount: 9870, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=sony+wh1000xm5', inStock: true },
            { storeName: 'Reliance Digital', price: 25999, originalPrice: 34990, discount: 25, rating: 4.5, reviewCount: 3210, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=sony+wh1000xm5', inStock: true }
        ]
    },
    {
        name: 'Apple AirPods Pro (2nd Gen) with MagSafe', brand: 'Apple', category: 'Audio', searchQuery: 'airpods pro 2',
        image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600',
        description: 'AirPods Pro 2nd gen with Adaptive Transparency, Personalized Spatial Audio, and up to 30 hours battery.',
        tags: ['airpods', 'apple', 'earbuds', 'anc', 'wireless'],
        stores: [
            { storeName: 'Amazon', price: 22490, originalPrice: 26900, discount: 16, rating: 4.6, reviewCount: 8920, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=airpods+pro+2', inStock: true },
            { storeName: 'Flipkart', price: 21999, originalPrice: 26900, discount: 18, rating: 4.5, reviewCount: 6740, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=airpods+pro+2', inStock: true },
            { storeName: 'Reliance Digital', price: 23499, originalPrice: 26900, discount: 12, rating: 4.4, reviewCount: 2890, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=airpods+pro+2', inStock: true }
        ]
    },
    {
        name: 'LG OLED C3 55" 4K Smart TV', brand: 'LG', category: 'Televisions', searchQuery: 'lg oled c3 55',
        image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600',
        description: 'LG OLED C3 with α9 AI Processor Gen6, Dolby Vision IQ, 120Hz, and NVIDIA G-Sync/AMD FreeSync.',
        tags: ['lg', 'oled', 'tv', '4k', 'smart', 'gaming'],
        stores: [
            { storeName: 'Amazon', price: 109999, originalPrice: 149900, discount: 26, rating: 4.8, reviewCount: 4560, delivery: 'Free, 5-day', deliveryDays: 5, link: 'https://www.amazon.in/s?k=lg+oled+c3+55', inStock: true },
            { storeName: 'Flipkart', price: 107499, originalPrice: 149900, discount: 28, rating: 4.7, reviewCount: 3890, delivery: 'Free, 5-day', deliveryDays: 5, link: 'https://www.flipkart.com/search?q=lg+oled+c3+55', inStock: true },
            { storeName: 'Reliance Digital', price: 112999, originalPrice: 149900, discount: 24, rating: 4.6, reviewCount: 2210, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.reliancedigital.in/search?q=lg+oled+c3+55', inStock: true }
        ]
    },
    {
        name: 'Nike Air Max 270 Running Shoes (Men, UK 9)', brand: 'Nike', category: 'Footwear', searchQuery: 'nike air max 270',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
        description: 'Nike Air Max 270 with Max Air heel unit for all-day comfort and sleek lifestyle design.',
        tags: ['nike', 'shoes', 'sneakers', 'running', 'sports'],
        stores: [
            { storeName: 'Amazon', price: 8495, originalPrice: 12995, discount: 34, rating: 4.4, reviewCount: 3210, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.amazon.in/s?k=nike+air+max+270', inStock: true },
            { storeName: 'Flipkart', price: 7999, originalPrice: 12995, discount: 38, rating: 4.3, reviewCount: 2890, delivery: 'Free, 4-day', deliveryDays: 4, link: 'https://www.flipkart.com/search?q=nike+air+max+270', inStock: true },
            { storeName: 'Myntra', price: 8195, originalPrice: 12995, discount: 36, rating: 4.4, reviewCount: 5670, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.myntra.com/nike+air+max+270', inStock: true }
        ]
    },
    {
        name: 'Levi\'s 511 Slim Fit Jeans (Dark Wash, W32 L30)', brand: 'Levi\'s', category: 'Clothing', searchQuery: "levi's 511 jeans",
        image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600',
        description: "Levi's 511 Slim Fit jeans with stretch denim for a sleek slim fit that sits below the waist.",
        tags: ['levis', 'jeans', 'clothing', 'denim', 'fashion'],
        stores: [
            { storeName: 'Amazon', price: 2499, originalPrice: 3999, discount: 37, rating: 4.3, reviewCount: 8760, delivery: 'Free, 3-day', deliveryDays: 3, link: "https://www.amazon.in/s?k=levi's+511+jeans", inStock: true },
            { storeName: 'Flipkart', price: 2299, originalPrice: 3999, discount: 42, rating: 4.2, reviewCount: 6540, delivery: 'Free, 4-day', deliveryDays: 4, link: "https://www.flipkart.com/search?q=levi's+511+jeans", inStock: true },
            { storeName: 'Myntra', price: 2399, originalPrice: 3999, discount: 40, rating: 4.4, reviewCount: 12340, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.myntra.com/levis+511+jeans', inStock: true }
        ]
    },
    {
        name: 'Dyson V15 Detect Cordless Vacuum Cleaner', brand: 'Dyson', category: 'Appliances', searchQuery: 'dyson v15',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
        description: 'Dyson V15 Detect with laser dust detection, 240AW suction, and 60 minutes battery life.',
        tags: ['dyson', 'vacuum', 'appliance', 'cordless'],
        stores: [
            { storeName: 'Amazon', price: 52900, originalPrice: 69900, discount: 24, rating: 4.7, reviewCount: 2340, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.amazon.in/s?k=dyson+v15', inStock: true },
            { storeName: 'Flipkart', price: 54999, originalPrice: 69900, discount: 21, rating: 4.6, reviewCount: 1870, delivery: 'Free, 5-day', deliveryDays: 5, link: 'https://www.flipkart.com/search?q=dyson+v15', inStock: true }
        ]
    },
    {
        name: 'boAt Rockerz 450 Wireless Headphones', brand: 'boAt', category: 'Audio', searchQuery: 'boat rockerz 450',
        image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600',
        description: 'boAt Rockerz 450 with 15-hour battery, 40mm drivers, and foldable design for on-the-go listening.',
        tags: ['boat', 'headphones', 'wireless', 'budget', 'audio'],
        stores: [
            { storeName: 'Amazon', price: 1299, originalPrice: 2990, discount: 56, rating: 4.1, reviewCount: 45320, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=boat+rockerz+450', inStock: true },
            { storeName: 'Flipkart', price: 1199, originalPrice: 2990, discount: 59, rating: 4.0, reviewCount: 38970, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=boat+rockerz+450', inStock: true }
        ]
    },
    {
        name: 'Samsung 65" Crystal 4K UHD Smart TV (2023)', brand: 'Samsung', category: 'Televisions', searchQuery: 'samsung crystal 4k 65',
        image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600',
        description: 'Samsung Crystal 4K UHD TV with Motion Xcelerator, Object Tracking Sound, and Alexa built-in.',
        tags: ['samsung', 'tv', '4k', 'smart', 'uhd'],
        stores: [
            { storeName: 'Amazon', price: 68990, originalPrice: 94900, discount: 27, rating: 4.5, reviewCount: 3870, delivery: 'Free, 5-day', deliveryDays: 5, link: 'https://www.amazon.in/s?k=samsung+65+4k+tv', inStock: true },
            { storeName: 'Flipkart', price: 66999, originalPrice: 94900, discount: 29, rating: 4.4, reviewCount: 3210, delivery: 'Free, 5-day', deliveryDays: 5, link: 'https://www.flipkart.com/search?q=samsung+65+4k+tv', inStock: true },
            { storeName: 'Reliance Digital', price: 71999, originalPrice: 94900, discount: 24, rating: 4.3, reviewCount: 1540, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.reliancedigital.in/search?q=samsung+65+4k+tv', inStock: true }
        ]
    },
];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB connected');
        await Product.deleteMany({});
        console.log('🗑️  Cleared existing products');

        for (const data of PRODUCTS) {
            const priceHistory = [];
            for (const store of data.stores) {
                priceHistory.push(...genHistory(store.storeName, store.price, 30));
            }
            const product = new Product({ ...data, priceHistory });
            await product.save();
            console.log(`✅ Seeded: ${data.name}`);
        }

        console.log(`\n🎉 Seeding complete! ${PRODUCTS.length} products added to MongoDB.`);
    } catch (err) {
        console.error('❌ Seed error:', err.message);
    } finally {
        mongoose.disconnect();
    }
}

seed();
