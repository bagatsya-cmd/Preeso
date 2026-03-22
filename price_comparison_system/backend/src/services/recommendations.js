const Product = require('../models/product');
const User = require('../models/User');

exports.getRecommendations = async (userId) => {
  const user = await User.findById(userId).populate('favorites');
  const categories = user.favorites.map(fav => fav.category).filter(Boolean);
  const products = await Product.find({ category: { $in: categories } });
  // Sort by price + rating
  return products.sort((a, b) => (a.platforms[0].price + (5 - a.platforms[0].rating)) - (b.platforms[0].price + (5 - b.platforms[0].rating))).slice(0, 5);
};