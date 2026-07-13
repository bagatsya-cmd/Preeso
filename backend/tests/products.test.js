const request = require('supertest');
const app = require('../src/app');

describe('Products API', () => {
  it('should return products for a search query', async () => {
    const res = await request(app).get('/api/products/search?query=iPhone');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});