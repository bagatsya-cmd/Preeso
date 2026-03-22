# Cross-Platform Product Price Comparison System

A web-based system to search and compare product prices across e-commerce platforms like Amazon, Flipkart, eBay, and Walmart.

## Features
- Search by name, category, or brand.
- Real-time price fetching via APIs/scraping.
- Responsive UI with sorting/filtering.
- Price history, alerts, wishlist, and AI recommendations.
- Currency conversion.

## Tech Stack
- Frontend: Next.js, Tailwind CSS.
- Backend: Node.js, Express, MongoDB.
- Scraping: Puppeteer, Cheerio.

## Setup
1. Clone the repo.
2. Install dependencies: `cd backend && npm install`, `cd frontend && npm install`.
3. Set up `.env` from `.env.example`.
4. Run with Docker: `docker-compose up` (includes MongoDB).
   - Or manually: Start MongoDB, then `npm run dev` in backend and frontend.
5. Access at http://localhost:3000.

## Usage
- Search for products on the homepage.
- Login to access wishlist and alerts.
- View price history on product details.

## API Endpoints
- GET /api/products/search?query=...
- POST /api/auth/login
- Etc. (see routes).

## Testing
- Backend: `npm test`.
- Frontend: `npm test`.

## Deployment
- Frontend: Vercel.
- Backend: Heroku/AWS.
- Ensure ethical scraping and API compliance.

For issues, open a PR!