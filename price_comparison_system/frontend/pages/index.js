import { useState, useEffect } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';

const CATEGORIES = ['All', 'Smartphones', 'Laptops', 'Audio', 'Televisions', 'Footwear', 'Clothing', 'Appliances'];
const PLATFORM_LOGOS = [
  { name: 'Amazon', color: '#ff9900', icon: '🛒' },
  { name: 'Flipkart', color: '#2874f0', icon: '🛍️' },
  { name: 'Myntra', color: '#ff3f6c', icon: '👗' },
  { name: 'Reliance Digital', color: '#e11d48', icon: '📱' },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('bestPrice');
  const [error, setError] = useState('');

  // Load trending and recommendations on mount
  useEffect(() => {
    axios.get('/api/products/trending').then(r => setTrending(r.data)).catch(() => { });

    const token = localStorage.getItem('comparex_token');
    if (token) {
      axios.get('/api/products/user/recommendations', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => setRecommendations(r.data)).catch(() => { });
    }
  }, []);

  const handleSearch = async (query) => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(`/api/products/search?query=${encodeURIComponent(query)}`);
      setProducts(res.data);
      setSearched(true);

      const token = localStorage.getItem('comparex_token');
      if (token) {
        axios.post('/api/products/history/search', { query }, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>{});
      }
    } catch {
      setError('Failed to fetch results. Make sure the backend is running.');
    } finally { setLoading(false); }
  };

  const displayProducts = searched ? products : trending;
  const filtered = category === 'All' ? displayProducts : displayProducts.filter(p => p.category === category);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'bestPrice') return (a.lowestPrice || 0) - (b.lowestPrice || 0);
    if (sortBy === 'highPrice') return (b.lowestPrice || 0) - (a.lowestPrice || 0);
    if (sortBy === 'discount') {
      const aDisc = a.stores?.[0]?.discount || 0;
      const bDisc = b.stores?.[0]?.discount || 0;
      return bDisc - aDisc;
    }
    return 0;
  });

  return (
    <>
      <Head>
        <title>CompareX — Compare Prices from Amazon, Flipkart, Myntra & More</title>
        <meta name="description" content="CompareX helps you find the best prices across Amazon, Flipkart, Myntra, and Reliance Digital. Track prices, set alerts, save money." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>" />
      </Head>

      <Navbar />

      {/* ── Hero Section ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '120px 24px 80px' }}>
        {/* Background orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', right: '15%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 860, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Tag */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 99, padding: '6px 16px', marginBottom: 32, fontSize: '0.8rem', fontWeight: 600, color: '#a5b4fc' }}>
            <span>⚡</span> India's Smartest Price Comparison Engine
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1.1, marginBottom: 24 }}>
            Compare Prices.<br />
            <span style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Save More.</span>
          </h1>

          <p style={{ fontSize: '1.15rem', color: '#9ca3af', maxWidth: 560, margin: '0 auto 48px', lineHeight: 1.7 }}>
            Instantly compare prices from Amazon, Flipkart, Myntra & Reliance Digital. Set price alerts and never overpay again.
          </p>

          <SearchBar onSearch={handleSearch} loading={loading} />

          {/* Platform badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
            {PLATFORM_LOGOS.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, fontSize: '0.78rem', color: '#9ca3af' }}>
                <span>{p.icon}</span> {p.name}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 48, flexWrap: 'wrap' }}>
            {[['10M+', 'Products Tracked'], ['₹2.4Cr', 'Saved by Users'], ['4', 'Platforms']].map(([val, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{val}</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Error ── */}
      {error && (
        <div style={{ maxWidth: 700, margin: '0 auto 32px', padding: '14px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#ef4444', textAlign: 'center', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* ── Products Section ── */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                {searched ? '🔍 Search Results' : '🔥 Trending Products'}
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>
                {sorted.length} products found across all platforms
              </p>
            </div>
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, color: '#d1d5db', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', cursor: 'pointer' }}>
              <option value="bestPrice">Sort: Best Price</option>
              <option value="highPrice">Sort: High to Low</option>
              <option value="discount">Sort: Biggest Discount</option>
            </select>
          </div>

          {/* Categories */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 32, overflowX: 'auto', paddingBottom: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{ padding: '8px 18px', borderRadius: 99, border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', background: category === cat ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', borderColor: category === cat ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)', color: category === cat ? '#a5b4fc' : '#9ca3af' }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="products-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="card" style={{ height: 480 }}>
                  <div className="skeleton" style={{ height: 200 }} />
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="skeleton" style={{ height: 14, width: '40%', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 18, borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 18, width: '70%', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 30, width: '50%', borderRadius: 4 }} />
                    {[1, 2, 3].map(j => <div key={j} className="skeleton" style={{ height: 32, borderRadius: 8 }} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Product grid */}
          {!loading && sorted.length > 0 && (
            <div className="products-grid">
              {sorted.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          )}

          {/* Empty state */}
          {!loading && sorted.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>🔍</div>
              <h3 style={{ fontSize: '1.3rem', color: '#9ca3af', marginBottom: 8 }}>Start searching to compare prices</h3>
              <p style={{ fontSize: '0.875rem' }}>Try searching for "iPhone", "Samsung", "headphones" or any product name</p>
            </div>
          )}

          {/* Recommendations (Only if not searched) */}
          {!searched && recommendations.length > 0 && (
            <div style={{ marginTop: 60 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>⭐</span> Recommended for You
                </h2>
              </div>
              <div className="products-grid">
                {recommendations.slice(0, 4).map(p => <ProductCard key={p._id} product={p} />)}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── How It Works ── */}
      {!searched && (
        <section style={{ padding: '80px 24px', background: 'rgba(99,102,241,0.04)', borderTop: '1px solid rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', marginBottom: 8 }}>How CompareX Works</h2>
            <p style={{ color: '#9ca3af', marginBottom: 56 }}>Three simple steps to saving money</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
              {[
                { step: '01', icon: '🔍', title: 'Search Any Product', desc: 'Type any product name — phone, laptop, shoes, appliance — and hit Compare.' },
                { step: '02', icon: '⚖️', title: 'Compare Live Prices', desc: 'See real-time prices from Amazon, Flipkart, Myntra & Reliance Digital side by side.' },
                { step: '03', icon: '🔔', title: 'Set Price Alerts', desc: 'Set your target price and we\'ll email you when it drops. Never miss a deal.' },
              ].map(item => (
                <div key={item.step} style={{ background: 'var(--bg-card)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 20, padding: 32, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 20, right: 20, fontSize: '0.75rem', fontWeight: 800, color: 'rgba(99,102,241,0.4)', fontFamily: 'Outfit, sans-serif' }}>{item.step}</div>
                  <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{item.icon}</div>
                  <h3 style={{ fontWeight: 700, marginBottom: 10, fontSize: '1rem' }}>{item.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ padding: '40px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <span style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CompareX</span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>Compare prices from Amazon, Flipkart, Myntra & Reliance Digital</p>
        <p style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: 8 }}>© 2024 CompareX. Built for smart shoppers.</p>
      </footer>
    </>
  );
}