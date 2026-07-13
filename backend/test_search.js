const axios = require('axios');

async function test() {
    try {
        const res = await axios.get('http://127.0.0.1:5000/api/products/search?query=tshirt');
        console.log('Returned items count:', res.data.length);
        if (res.data.length > 0) {
            console.log('First item keys:', Object.keys(res.data[0]));
            if (!res.data[0]._id) {
               console.log("CRITICAL ERROR: _id IS MISSING FROM SEARCH RESULTS!");
               console.log(res.data[0]);
            } else {
               console.log("It has an _id. ID:", res.data[0]._id);
            }
        }
    } catch(err) {
        console.error('Error fetching search API:', err.message);
    }
}
test();
