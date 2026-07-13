const axios = require('axios');

const testApi = async () => {
    try {
        const response = await axios.get('https://real-time-product-search.p.rapidapi.com/search?q=iphone&country=in', {
            headers: {
                'x-rapidapi-host': 'real-time-product-search.p.rapidapi.com',
                'x-rapidapi-key': 'c74afa1c1bmshf094ab21c3e6bdcp1db9d6jsn83a31b6d014c'
            }
        });
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
};

testApi();
