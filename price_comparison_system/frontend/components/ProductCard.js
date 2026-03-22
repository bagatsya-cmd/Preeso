import Link from 'next/link';
import { useState } from 'react';
import axios from 'axios';

const STORE_COLORS = {
  Amazon: { bg: 'rgba(255,153,0,0.12)', text: '#ff9900', border: 'rgba(255,153,0,0.3)', icon: '🛒' },
  Flipkart: { bg: 'rgba(40,116,240,0.12)', text: '#2874f0', border: 'rgba(40,116,240,0.3)', icon: '🛍️' },
  Myntra: { bg: 'rgba(255,63,108,0.12)', text: '#ff3f6c', border: 'rgba(255,63,108,0.3)', icon: '👗' },
  'Reliance Digital': { bg: 'rgba(225,29,72,0.12)', text: '#e11d48', border: 'rgba(225,29,72,0.3)', icon: '📱' },
};

function formatPrice(p) {
  return '₹' + Number(p).toLocaleString('en-IN');
}

export default function ProductCard({ product }) {
  const [inWishlist, setInWishlist] = useState(false);
  const [toast, setToast] = useState('');

  const stores = product.stores || [];
  const lowestStore = stores.length > 0 ? stores.reduce((a, b) => (a.price < b.price ? a : b)) : null;
  const highestPrice = stores.length > 0 ? Math.max(...stores.map(s => s.price)) : 0;
  const savings = lowestStore && lowestStore.originalPrice ? lowestStore.originalPrice - lowestStore.price : 0;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const toggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('comparex_token');
    if (!token) { showToast('Please login to save to wishlist'); return; }
    try {
      await axios.post(`/api/wishlist/${product._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setInWishlist(p => !p);
      showToast(inWishlist ? 'Removed from wishlist' : 'Added to wishlist ❤️');
    } catch { showToast('Error updating wishlist'); }
  };

  return (
    <div className="card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', cursor: 'pointer', overflow: 'visible' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '12px 18px', borderRadius: 10, background: 'rgba(22,22,31,0.97)', border: '1px solid rgba(99,102,241,0.3)', color: '#d1d5db', fontSize: '0.875rem', fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}>
          {toast}
        </div>
      )}

      {/* Wishlist button */}
      <button onClick={toggleWishlist} id={`wishlist-${product._id}`} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(10,10,15,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}>
        {inWishlist ? '❤️' : '🤍'}
      </button>

      {/* Product image */}
      <Link href={`/product/${product._id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ position: 'relative', height: 200, background: 'rgba(255,255,255,0.03)', overflow: 'hidden', borderRadius: '16px 16px 0 0' }}>
          <img
            src={product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            onError={e => { e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'; }}
          />
          {/* Category badge */}
          {product.category && (
            <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(10px)', padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, border: '1px solid rgba(255,255,255,0.08)' }}>
              {product.category}
            </div>
          )}
          {/* Best deal badge */}
          {lowestStore && lowestStore.discount >= 15 && (
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'linear-gradient(135deg, #22c55e, #16a34a)', padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', color: 'white', fontWeight: 700 }}>
              🔥 {lowestStore.discount}% OFF
            </div>
          )}
        </div>

        <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Brand */}
          {product.brand && <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{product.brand}</span>}

          {/* Name */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f1f5', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {product.name}
          </h3>

          {/* Best price */}
          {lowestStore && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#22c55e' }}>{formatPrice(lowestStore.price)}</span>
              {lowestStore.originalPrice > lowestStore.price && (
                <span style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'line-through' }}>{formatPrice(lowestStore.originalPrice)}</span>
              )}
            </div>
          )}

          {savings > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>You save {formatPrice(savings)} on {lowestStore?.storeName}</div>
          )}

          {/* Platform price comparison */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stores.slice(0, 3).map((store, i) => {
              const colors = STORE_COLORS[store.storeName] || { bg: 'rgba(255,255,255,0.05)', text: '#9ca3af', border: 'rgba(255,255,255,0.1)', icon: '🏪' };
              const isBest = lowestStore && store.storeName === lowestStore.storeName;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: isBest ? 'rgba(34,197,94,0.08)' : colors.bg, border: `1px solid ${isBest ? 'rgba(34,197,94,0.25)' : colors.border}`, transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.8rem' }}>{colors.icon}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isBest ? '#22c55e' : colors.text }}>{store.storeName}</span>
                    {isBest && <span style={{ fontSize: '0.65rem', background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>BEST</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {store.discount > 0 && <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>-{store.discount}%</span>}
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f1f1f5' }}>{formatPrice(store.price)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom: rating + delivery */}
          {lowestStore && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>{'★'.repeat(Math.round(lowestStore.rating || 4))}</span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{lowestStore.rating?.toFixed(1)} ({(lowestStore.reviewCount || 0).toLocaleString()})</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>🚚 {lowestStore.delivery}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Compare button */}
      <div style={{ padding: '0 20px 20px' }}>
        <Link href={`/product/${product._id}`} style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))'}
        >
          ⚡ Compare All Prices →
        </Link>
      </div>
    </div>
  );
}