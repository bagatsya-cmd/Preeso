const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('../src/app');

describe('Products API', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/Preeso';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should return products for a search query', async () => {
    const res = await request(app).get('/api/products/search?query=iPhone');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});