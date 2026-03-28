const axios = require('axios');
const cheerio = require('cheerio');

// Realistic browser headers to avoid basic bot detection
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
};

const TIMEOUT = 8000;

// ------------------------------------------------------------------
// Demo Data — Rich deterministic fallback so the app ALWAYS returns data
// These simulate real-world pricing patterns across 4 Indian platforms
// ------------------------------------------------------------------
const DEMO_PRODUCTS = {
    iphone: [
        { name: 'Apple iPhone 15 (128GB, Black)', brand: 'Apple', category: 'Smartphones', image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400', tags: ['iphone', 'apple', 'smartphone'], stores: [{ storeName: 'Amazon', price: 69999, originalPrice: 79900, discount: 12, rating: 4.5, reviewCount: 3420, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=iphone+15', inStock: true }, { storeName: 'Flipkart', price: 71499, originalPrice: 79900, discount: 10, rating: 4.4, reviewCount: 2870, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=iphone+15', inStock: true }, { storeName: 'Reliance Digital', price: 72999, originalPrice: 79900, discount: 8, rating: 4.3, reviewCount: 980, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=iphone+15', inStock: true }] },
        { name: 'Apple iPhone 15 Pro (256GB, Titanium)', brand: 'Apple', category: 'Smartphones', image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400', tags: ['iphone', 'apple', 'pro', 'smartphone'], stores: [{ storeName: 'Amazon', price: 119999, originalPrice: 134900, discount: 11, rating: 4.7, reviewCount: 5120, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=iphone+15+pro', inStock: true }, { storeName: 'Flipkart', price: 121000, originalPrice: 134900, discount: 10, rating: 4.6, reviewCount: 4210, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=iphone+15+pro', inStock: true }] },
    ],
    samsung: [
        { name: 'Samsung Galaxy S24 Ultra (256GB, Titanium Black)', brand: 'Samsung', category: 'Smartphones', image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400', tags: ['samsung', 'galaxy', 'android', 'smartphone'], stores: [{ storeName: 'Amazon', price: 109999, originalPrice: 129999, discount: 15, rating: 4.6, reviewCount: 4120, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=samsung+s24+ultra', inStock: true }, { storeName: 'Flipkart', price: 107499, originalPrice: 129999, discount: 17, rating: 4.5, reviewCount: 3680, delivery: 'Free, Next Day', deliveryDays: 1, link: 'https://www.flipkart.com/search?q=samsung+s24+ultra', inStock: true }, { storeName: 'Reliance Digital', price: 111999, originalPrice: 129999, discount: 13, rating: 4.4, reviewCount: 1120, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=samsung+s24+ultra', inStock: false }] },
        { name: 'Samsung Galaxy A54 5G (128GB, Awesome Violet)', brand: 'Samsung', category: 'Smartphones', image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400', tags: ['samsung', 'galaxy', '5g', 'budget'], stores: [{ storeName: 'Amazon', price: 28999, originalPrice: 38999, discount: 25, rating: 4.3, reviewCount: 6780, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=samsung+a54', inStock: true }, { storeName: 'Flipkart', price: 27499, originalPrice: 38999, discount: 29, rating: 4.4, reviewCount: 8420, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=samsung+a54', inStock: true }] },
    ],
    laptop: [
        { name: 'Apple MacBook Air M2 (8GB/256GB, Midnight)', brand: 'Apple', category: 'Laptops', image: 'https://images.unsplash.com/photo-1611186871525-5f5daaeba28c?w=400', tags: ['macbook', 'apple', 'laptop', 'm2'], stores: [{ storeName: 'Amazon', price: 94990, originalPrice: 114900, discount: 17, rating: 4.8, reviewCount: 7210, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=macbook+air+m2', inStock: true }, { storeName: 'Flipkart', price: 92999, originalPrice: 114900, discount: 19, rating: 4.7, reviewCount: 5840, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=macbook+air+m2', inStock: true }, { storeName: 'Reliance Digital', price: 97999, originalPrice: 114900, discount: 14, rating: 4.6, reviewCount: 2100, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=macbook+air+m2', inStock: true }] },
        { name: 'Dell XPS 15 (Intel i7-13700H, RTX 4060, 16GB/512GB)', brand: 'Dell', category: 'Laptops', image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400', tags: ['dell', 'xps', 'laptop', 'gaming'], stores: [{ storeName: 'Amazon', price: 129999, originalPrice: 154900, discount: 16, rating: 4.5, reviewCount: 2340, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.amazon.in/s?k=dell+xps+15', inStock: true }, { storeName: 'Flipkart', price: 127499, originalPrice: 154900, discount: 17, rating: 4.4, reviewCount: 1890, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=dell+xps+15', inStock: true }] },
    ],
    headphones: [
        { name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', brand: 'Sony', category: 'Audio', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', tags: ['sony', 'headphones', 'anc', 'wireless'], stores: [{ storeName: 'Amazon', price: 24990, originalPrice: 34990, discount: 28, rating: 4.7, reviewCount: 12430, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=sony+wh1000xm5', inStock: true }, { storeName: 'Flipkart', price: 23999, originalPrice: 34990, discount: 31, rating: 4.6, reviewCount: 9870, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=sony+wh1000xm5', inStock: true }, { storeName: 'Reliance Digital', price: 25999, originalPrice: 34990, discount: 25, rating: 4.5, reviewCount: 3210, delivery: 'Free, Same Day', deliveryDays: 0, link: 'https://www.reliancedigital.in/search?q=sony+wh1000xm5', inStock: true }] },
        { name: 'Apple AirPods Pro (2nd Gen) with MagSafe', brand: 'Apple', category: 'Audio', image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400', tags: ['airpods', 'apple', 'earbuds', 'anc'], stores: [{ storeName: 'Amazon', price: 22490, originalPrice: 26900, discount: 16, rating: 4.6, reviewCount: 8920, delivery: 'Free, 2-day', deliveryDays: 2, link: 'https://www.amazon.in/s?k=airpods+pro+2', inStock: true }, { storeName: 'Flipkart', price: 21999, originalPrice: 26900, discount: 18, rating: 4.5, reviewCount: 6740, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.flipkart.com/search?q=airpods+pro+2', inStock: true }] },
    ],
    tv: [
        { name: 'LG OLED C3 55" 4K Smart TV', brand: 'LG', category: 'Televisions', image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400', tags: ['lg', 'oled', 'tv', '4k', 'smart'], stores: [{ storeName: 'Amazon', price: 109999, originalPrice: 149900, discount: 26, rating: 4.8, reviewCount: 4560, delivery: 'Free, 5-day', deliveryDays: 5, link: 'https://www.amazon.in/s?k=lg+oled+c3+55', inStock: true }, { storeName: 'Flipkart', price: 107499, originalPrice: 149900, discount: 28, rating: 4.7, reviewCount: 3890, delivery: 'Free, 5-day', deliveryDays: 5, link: 'https://www.flipkart.com/search?q=lg+oled+c3+55', inStock: true }, { storeName: 'Reliance Digital', price: 112999, originalPrice: 149900, discount: 24, rating: 4.6, reviewCount: 2210, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.reliancedigital.in/search?q=lg+oled+c3+55', inStock: true }] },
    ],
    shoes: [
        { name: 'Nike Air Max 270 (Men, UK 9)', brand: 'Nike', category: 'Footwear', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', tags: ['nike', 'shoes', 'sneakers', 'running'], stores: [{ storeName: 'Amazon', price: 8495, originalPrice: 12995, discount: 34, rating: 4.4, reviewCount: 3210, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.amazon.in/s?k=nike+air+max+270', inStock: true }, { storeName: 'Flipkart', price: 7999, originalPrice: 12995, discount: 38, rating: 4.3, reviewCount: 2890, delivery: 'Free, 4-day', deliveryDays: 4, link: 'https://www.flipkart.com/search?q=nike+air+max+270', inStock: true }, { storeName: 'Myntra', price: 8195, originalPrice: 12995, discount: 36, rating: 4.4, reviewCount: 5670, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.myntra.com/nike+air+max+270', inStock: true }] },
        { name: 'Adidas Ultraboost 22 (Unisex, UK 8)', brand: 'Adidas', category: 'Footwear', image: 'https://images.unsplash.com/photo-1543508282-6319a3e2621f?w=400', tags: ['adidas', 'shoes', 'running', 'boost'], stores: [{ storeName: 'Amazon', price: 11999, originalPrice: 17999, discount: 33, rating: 4.5, reviewCount: 2340, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.amazon.in/s?k=adidas+ultraboost+22', inStock: true }, { storeName: 'Myntra', price: 11499, originalPrice: 17999, discount: 36, rating: 4.5, reviewCount: 4120, delivery: 'Free, 3-day', deliveryDays: 3, link: 'https://www.myntra.com/adidas+ultraboost', inStock: true }] },
    ],
};

function findDemoProducts(query) {
    const q = query.toLowerCase().trim();
    const results = [];
    for (const [key, products] of Object.entries(DEMO_PRODUCTS)) {
        for (const product of products) {
            const matches =
                key.includes(q) ||
                q.includes(key) ||
                product.name.toLowerCase().includes(q) ||
                product.brand.toLowerCase().includes(q) ||
                product.tags.some(t => t.includes(q) || q.includes(t));
            if (matches && !results.find(r => r.name === product.name)) {
                results.push(product);
            }
        }
    }
    // Generic fallback — return a mix of trending products
    if (results.length === 0) {
        return [
            DEMO_PRODUCTS.iphone[0],
            DEMO_PRODUCTS.samsung[0],
            DEMO_PRODUCTS.headphones[0],
            DEMO_PRODUCTS.laptop[0],
        ].filter(Boolean);
    }
    return results;
}

// ------------------------------------------------------------------
// Real-Time Product Search RapidAPI
// ------------------------------------------------------------------
async function fetchFromRapidAPI(query) {
    if (!process.env.RAPIDAPI_KEY) {
        console.warn("RapidAPI key not found in env, falling back to demo data");
        return null;
    }
    try {
        const { data } = await axios.get('https://real-time-product-search.p.rapidapi.com/product-search', {
            headers: {
                'x-rapidapi-host': 'real-time-product-search.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPIDAPI_KEY
            },
            params: {
                query: query,
                country: 'in', // use 'in' for India to match dummy data, or 'us'
                language: 'en'
            },
            timeout: TIMEOUT
        });
        
        // Transform the response to match our ProductSchema
        // Note: The specific response structure of this API might vary, 
        // assuming standard array of products or data.products
        const items = data.data || data.products || data;
        const results = [];
        
        if (Array.isArray(items)) {
            for (const item of items.slice(0, 10)) {
                if (item.product_title && item.product_price) {
                    results.push({
                        name: item.product_title,
                        brand: item.product_brand || 'Unknown',
                        category: item.product_category || 'General',
                        description: item.product_description || '',
                        image: item.product_main_image_url || item.product_image || '',
                        tags: query.split(' '),
                        stores: [{
                            storeName: item.offer_store_name || 'Amazon',
                            price: parseFloat(item.product_price.replace(/[^0-9.]/g, '')),
                            originalPrice: item.product_original_price ? parseFloat(item.product_original_price.replace(/[^0-9.]/g, '')) : parseFloat(item.product_price.replace(/[^0-9.]/g, '')),
                            delivery: item.app_sale_price ? 'Sale' : 'Standard',
                            link: item.product_details_page_link || item.product_link || '',
                            rating: parseFloat(item.product_rating) || 4.5,
                            reviewCount: parseInt(item.product_num_reviews) || 0,
                            inStock: true
                        }]
                    });
                }
            }
        }
        return results.length > 0 ? results : null;
    } catch (err) {
        console.error("RapidAPI Error:", err.message);
        return null;
    }
}

// ------------------------------------------------------------------
// Main export — search across all platforms
// ------------------------------------------------------------------
exports.searchAllPlatforms = async (query) => {
    const rapidApiResults = await fetchFromRapidAPI(query);
    const demoProducts = findDemoProducts(query);

    // If we got real data from the API, use it
    if (rapidApiResults && rapidApiResults.length > 0) {
        return rapidApiResults;
    }

    // Full demo mode fallback
    return demoProducts;
};

// Export demo data lookup for seeding
exports.getDemoProducts = () => {
    return Object.values(DEMO_PRODUCTS).flat();
};

exports.findDemoProducts = findDemoProducts;
