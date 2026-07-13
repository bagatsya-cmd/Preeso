import axios from 'axios';

const api = axios.create({
  baseURL: 'https://real-time-product-search.p.rapidapi.com',
  headers: {
    'Content-Type': 'application/json',
    'x-rapidapi-host': 'real-time-product-search.p.rapidapi.com',
    'x-rapidapi-key': process.env.REACT_APP_RAPIDAPI_KEY
  }
});

export const searchProducts = async (query) => {
  try {
    const response = await api.get('/product-search', {
      params: {
        query: query,
        country: 'us',
        language: 'en'
      }
    });
    return response.data;
  } catch (error) {
    console.error("Search API Error:", error.response?.data || error.message);
  }
};

export default api;