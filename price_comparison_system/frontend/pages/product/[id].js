import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import PriceHistoryChart from '../../components/PriceHistoryChart';
import AlertForm from '../../components/AlertForm';

const STORE_COLORS = {
  Amazon: { bg: 'rgba(255,153,0,0.1)', text: '#ff9900', border: 'rgba(255,153,0,0.25)', icon: '🛒' },
  Flipkart: { bg: 'rgba(40,116,240,0.1)', text: '#2874f0', border: 'rgba(40,116,240,0.25)', icon: '🛍️' },
  Myntra: { bg: 'rgba(255,63,108,0.1)', text: '#ff3f6c', border: 'rgba(255,63,108,0.25)', icon: '👗' },
  'Reliance Digital': { bg: 'rgba(225,29,72,0.1)', text: '#e11d48', border: 'rgba(225,29,72,0.25)', icon: '📱' },
};

function formatPrice(p) { return '₹' + Number(p).toLocaleString('en-IN'); }

export default function ProductPage() {
  const router = useRouter();
  const { id } = router.query;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/products/${id}`).then(r => { setProduct(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 48, height: 48 }} />
        <p style={{ color: '#9ca3af' }}>Loading product...</p>
      </div>
    </>
  );

  if (!product) return (
    <>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: '3rem' }}>📦</span>
        <h2 style={{ color: '#9ca3af' }}>Product not found</h2>
        <button onClick={() => router.push('/')} className="btn btn-primary">Back to Home</button>
      </div>
    </>
  );

  const stores = product.stores || [];
  const lowestStore = stores.length > 0 ? stores.reduce((a, b) => a.price < b.price ? a : b) : null;
  const savings = lowestStore?.originalPrice ? lowestStore.originalPrice - lowestStore.price : 0;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const toggleWishlist = async () => {
    const token = localStorage.getItem('comparex_token');
    if (!token) { showToast('Please login to use wishlist'); return; }
    try {
      await axios.post(`/api/wishlist/${product._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setInWishlist(p => !p); showToast(inWishlist ? 'Removed from wishlist' : 'Added to wishlist ❤️');
    } catch { showToast('Error updating wishlist'); }
  };

  return (
    <>
      <Head>
        <title>{product.name} — Price Comparison | CompareX</title>
        <meta name="description" content={`Compare prices for ${product.name} across Amazon, Flipkart, Myntra and more on CompareX.`} />
      </Head>
      <Navbar />

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '12px 18px', borderRadius: 10, background: 'rgba(22,22,31,0.97)', border: '1px solid rgba(99,102,241,0.3)', color: '#d1d5db', fontSize: '0.875rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}>{toast}</div>}

      <main style={{ paddingTop: 100, paddingBottom: 80, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, fontSize: '0.8rem', color: '#6b7280' }}>
            <a href="/" style={{ color: '#6366f1', textDecoration: 'none' }}>Home</a>
            <span>›</span>
            {product.category && <><a href="/" style={{ color: '#6366f1', textDecoration: 'none' }}>{product.category}</a><span>›</span></>}
            <span style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{product.name}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 480px) 1fr', gap: 40, alignItems: 'start' }}>
            {/* Left: Image */}
            <div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'; }} />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button onClick={toggleWishlist} style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: inWishlist ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', color: inWishlist ? '#ef4444' : '#9ca3af', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {inWishlist ? '❤️ Saved' : '🤍 Save'}
                </button>
                {lowestStore && (
                  <a href={lowestStore.link} target="_blank" rel="noopener noreferrer" style={{ flex: 2, padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>
                    🛒 Buy on {lowestStore.storeName}
                  </a>
                )}
              </div>
            </div>

            {/* Right: Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Header */}
              <div>
                {product.brand && <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{product.brand}</span>}
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', lineHeight: 1.3, marginTop: 8, marginBottom: 12 }}>{product.name}</h1>
                {product.description && <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.7 }}>{product.description}</p>}
              </div>

              {/* Best price */}
              {lowestStore && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>✅ Best Price Available</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#22c55e' }}>{formatPrice(lowestStore.price)}</span>
                    {lowestStore.originalPrice > lowestStore.price && <span style={{ color: '#6b7280', textDecoration: 'line-through', fontSize: '1.1rem' }}>{formatPrice(lowestStore.originalPrice)}</span>}
                    {savings > 0 && <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>Save {formatPrice(savings)}</span>}
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#9ca3af' }}>on <strong style={{ color: '#d1d5db' }}>{lowestStore.storeName}</strong> · {lowestStore.delivery}</div>
                </div>
              )}

              {/* Price comparison table */}
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>📊 Price Comparison</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stores.map((store, i) => {
                    const colors = STORE_COLORS[store.storeName] || { bg: 'rgba(255,255,255,0.05)', text: '#9ca3af', border: 'rgba(255,255,255,0.1)', icon: '🏪' };
                    const isBest = lowestStore && store.storeName === lowestStore.storeName;
                    return (
                      <a key={i} href={store.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '16px 20px', borderRadius: 14, background: isBest ? 'rgba(34,197,94,0.06)' : colors.bg, border: `1px solid ${isBest ? 'rgba(34,197,94,0.25)' : colors.border}`, transition: 'all 0.2s', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                          <span style={{ fontSize: '1.3rem' }}>{colors.icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: isBest ? '#22c55e' : colors.text, fontSize: '0.9rem' }}>{store.storeName}</span>
                              {isBest && <span style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '1px 8px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 800 }}>BEST DEAL</span>}
                              {!store.inStock && <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '1px 8px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 700 }}>OUT OF STOCK</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>🚚 {store.delivery} · ⭐ {store.rating?.toFixed(1)} ({(store.reviewCount || 0).toLocaleString()} reviews)</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#f1f1f5' }}>{formatPrice(store.price)}</div>
                          {store.originalPrice > store.price && <div style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'line-through' }}>{formatPrice(store.originalPrice)}</div>}
                          {store.discount > 0 && <div style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 700 }}>{store.discount}% off</div>}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Alert Form */}
              <AlertForm productId={product._id} stores={stores} currentLowest={lowestStore?.price} />
            </div>
          </div>

          {/* Price History Chart */}
          {product.priceHistory && product.priceHistory.length > 0 && (
            <div style={{ marginTop: 56, background: 'var(--bg-card)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 24, padding: 32 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24 }}>📈 Price History (Last 30 Days)</h2>
              <PriceHistoryChart history={product.priceHistory} stores={stores} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}