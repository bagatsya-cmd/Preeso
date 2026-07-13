const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');

async function run() {
    let log = '';
    const _log = (str) => { log += str + '\n'; console.log(str); };
    
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/price_comparison');
        const User = require('./src/models/User');
        const Product = require('./src/models/product');
        
        let user = await User.findOne({});
        if (!user) {
             user = new User({ email: 'test_alert@mail.com', password: 'asd', name: 'Tester' });
             await user.save();
        }
        
        const prd = await Product.findOne({});
        if (!prd) return _log('No products');
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: user._id }, 'comparex_super_secret_key_2024');
        
        _log(`Hitting alert on product ${prd._id}`);
        try {
            const res = await axios.post(`http://127.0.0.1:5000/api/products/${prd._id}/alert`, {
               targetPrice: 500,
               storeName: 'Amazon'
            }, {
               headers: { Authorization: `Bearer ${token}` }
            });
            _log(`SetAlert: ${res.status} ${JSON.stringify(res.data)}`);
        } catch(e) {
            _log(`SET ALERT ERROR: ${e.response?.status} ${JSON.stringify(e.response?.data)} ${e.message}`);
        }
        
        try {
            const res2 = await axios.post(`http://127.0.0.1:5000/api/wishlist/${prd._id}`, {}, {
               headers: { Authorization: `Bearer ${token}` }
            });
            _log(`Wishlist: ${res2.status} ${JSON.stringify(res2.data)}`);
        } catch(e) {
            _log(`WISHLIST ERROR: ${e.response?.status} ${JSON.stringify(e.response?.data)} ${e.message}`);
        }

        try {
            const res3 = await axios.get(`http://127.0.0.1:5000/api/products/user/recommendations`, {
               headers: { Authorization: `Bearer ${token}` }
            });
            _log(`Recs: ${res3.status} items: ${res3.data?.length}`);
        } catch(e) {
            _log(`RECS ERROR: ${e.response?.status} ${JSON.stringify(e.response?.data)} ${e.message}`);
        }
    } catch(err) {
        _log(`Critical failure: ${err.message}`);
    } finally {
        fs.writeFileSync('endpoints.log', log, 'utf8');
        await mongoose.disconnect();
        process.exit(0);
    }
}
run();
