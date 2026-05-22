const Product = require('../models/product');
const User = require('../models/User');

exports.getRecommendations = async (userId) => {
  const user = await User.findById(userId).populate('wishlist');
  const categories = user.wishlist.map(fav => fav.category).filter(Boolean);
  const products = await Product.find({ category: { $in: categories } });
  // Sort by price + rating
return products
  .filter(p => p.stores?.length > 0)
  .sort((a, b) => {
    const aStore = a.stores[0];
    const bStore = b.stores[0];
    return (aStore.price + (5 - (aStore.rating || 0))) - 
           (bStore.price + (5 - (bStore.rating || 0)));
  })
  .slice(0, 5);
};