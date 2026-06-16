import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import PriceHistoryChart from '../../components/PriceHistoryChart';
import AlertForm from '../../components/AlertForm';

const STORE_COLORS = {
  Amazon:           { bg: 'var(--bg-card)', text: '#f5f5f5', border: 'var(--border-color)', icon: '🛒' },
  Flipkart:         { bg: 'var(--bg-card)', text: '#f5f5f5', border: 'var(--border-color)', icon: '🛍️' },
  Myntra:           { bg: 'var(--bg-card)', text: '#f5f5f5', border: 'var(--border-color)', icon: '👗' },
  'Reliance Digital': { bg: 'var(--bg-card)', text: '#f5f5f5', border: 'var(--border-color)', icon: '📱' },
  AJIO:             { bg: 'var(--bg-card)', text: '#f5f5f5', border: 'var(--border-color)', icon: '🖤' },
  Nykaa:            { bg: 'var(--bg-card)', text: '#f5f5f5', border: 'var(--border-color)', icon: '💄' },
};

// Platform chips — same as ProductCard for consistency
const PLATFORM_CHIPS = {
  AJIO:  { label: 'AJIO',  style: { background: '#000', color: '#fff', fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em' } },
  Nykaa: { label: 'NYKAA', style: { background: '#e91e8c', color: '#fff', fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em' } },
};
function PlatformChip({ storeName }) {
  const chip = PLATFORM_CHIPS[storeName];
  if (!chip) return null;
  return <span style={chip.style}>{chip.label}</span>;
}


function formatPrice(p) { return '₹' + Number(p).toLocaleString('en-IN'); }

export default function ProductPage() {
  const router = useRouter();
  const { id } = router.query;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/products/${id}`).then(r => { 
      setProduct(r.data); 
      setLoading(false); 
      
      const token = localStorage.getItem('preeso_token') || localStorage.getItem('comparex_token');
      if (token) {
        axios.post(`/api/products/history/view/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>{});
      }
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    </>
  );

  if (!product) return (
    <>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: '3rem' }}>📦</span>
        <h2 style={{ color: 'var(--text-secondary)' }}>Product not found</h2>
        <button onClick={() => router.push('/')} className="btn btn-outline">Back to Home</button>
      </div>
    </>
  );

  const stores = product.stores || [];
  const validStores = stores.filter(s => s.price > 0).sort((a,b) => a.price - b.price);
  const lowestStore = validStores.length > 0 ? validStores[0] : null;
  const savings = lowestStore?.originalPrice ? lowestStore.originalPrice - lowestStore.price : 0;

  const toggleWishlist = async () => {
    const token = localStorage.getItem('preeso_token') || localStorage.getItem('comparex_token');
    if (!token) return;
    try {
      await axios.post(`/api/wishlist/${product._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setInWishlist(p => !p); 
    } catch { }
  };

  return (
    <>
      <Head>
        <title>{product.name} | Preeso</title>
        <style>{`
          .mobile-buy-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--bg-primary);
            border-top: 1px solid var(--border-color);
            padding: 12px 16px;
            z-index: 100;
            display: none;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
          }
          @media (max-width: 768px) {
            .mobile-buy-bar { display: flex; align-items: center; gap: 16px; justify-content: space-between; }
            .product-layout { grid-template-columns: 1fr !important; gap: 24px !important; }
            .product-main { padding-bottom: 80px !important; }
            .desktop-actions { display: none !important; }
          }
        `}</style>
      </Head>
      <Navbar />

      <main className="product-main" style={{ paddingTop: 100, paddingBottom: 80, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <a href="/" style={{ color: 'var(--brand-accent)', textDecoration: 'none' }}>Home</a>
            <span>›</span>
            {product.category && <><a href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{product.category}</a><span>›</span></>}
            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{product.name}</span>
          </div>

          <div className="product-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 560px) 1fr', gap: 48, alignItems: 'start' }}>
            {/* Left: Image */}
            <div>
              <div style={{ background: 'var(--brand-primary)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative' }}>
                <img src={product.image || product.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'; }} />
                <button onClick={toggleWishlist} style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill={inWishlist ? "var(--error)" : "none"} stroke={inWishlist ? "var(--error)" : "var(--text-secondary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
              </div>

              {/* Action buttons (Desktop only) */}
              <div className="desktop-actions" style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                {lowestStore && (
                  <a href={lowestStore.link || lowestStore.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ flex: 1 }}>
                    Buy on {lowestStore.storeName}
                  </a>
                )}
              </div>
            </div>

            {/* Right: Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Header */}
              <div>
                {product.brand && <span style={{ fontSize: '0.85rem', color: 'var(--brand-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{product.brand}</span>}
                <h1 style={{ fontSize: '2.4rem', fontWeight: 600, lineHeight: 1.2, marginTop: 8, marginBottom: 12, color: 'var(--text-primary)' }}>{product.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--brand-accent)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    4.5
                  </span>
                  <span>·</span>
                  <span>2,000+ ratings</span>
                </div>
              </div>

              {/* Best price */}
              {lowestStore && (
                <div style={{ padding: '24px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Lowest Price Guaranteed</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(lowestStore.price)}</span>
                    {lowestStore.originalPrice > lowestStore.price && <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: '1.4rem' }}>{formatPrice(lowestStore.originalPrice)}</span>}
                    {savings > 0 && <span style={{ background: 'var(--success)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Save {formatPrice(savings)}</span>}
                    <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>Lowest in 30 days</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Available on <strong style={{ color: 'var(--text-primary)' }}>{lowestStore.storeName}</strong> · Free delivery {lowestStore.delivery || 'Tomorrow'}</div>
                </div>
              )}

              {/* Price comparison table */}
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Compare Stores</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {validStores.map((store, i) => {
                    const isBest = lowestStore && store.storeName === lowestStore.storeName;
                    return (
                      <a key={i} href={store.link || store.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '16px 20px', borderRadius: 8, background: isBest ? 'var(--bg-secondary)' : 'var(--bg-card)', border: `1px solid ${isBest ? 'var(--border-hover)' : 'var(--border-color)'}`, transition: 'all 0.2s', cursor: 'pointer' }}
                        onMouseEnter={e => { if(!isBest) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                        onMouseLeave={e => { if(!isBest) e.currentTarget.style.background = 'var(--bg-card)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{store.storeName}</span>
                              <PlatformChip storeName={store.storeName} />
                              {isBest && <span style={{ background: 'var(--brand-accent)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700 }}>BEST DEAL</span>}
                              {!store.inStock && store.inStock !== undefined && <span style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700 }}>OUT OF STOCK</span>}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>Delivery {store.delivery || 'in 2-3 days'}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatPrice(store.price)}</div>
                          {store.originalPrice > store.price && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatPrice(store.originalPrice)}</div>}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Alert Form */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, background: 'var(--bg-card)' }}>
                <AlertForm productId={product._id} stores={stores} currentLowest={lowestStore?.price} />
              </div>
            </div>
          </div>

          {/* Price History Chart */}
          {product.priceHistory && product.priceHistory.length > 0 && (
            <div style={{ marginTop: 64, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 32 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 24 }}>Price History (Last 30 Days)</h2>
              <PriceHistoryChart history={product.priceHistory} stores={stores} />
            </div>
          )}
        </div>
      </main>
      
      {/* Mobile Sticky Buy Button */}
      {lowestStore && (
        <div className="mobile-buy-bar">
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(lowestStore.price)}</div>
          </div>
          <a href={lowestStore.link || lowestStore.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '12px 24px', whiteSpace: 'nowrap' }}>
            Buy Now
          </a>
        </div>
      )}
    </>
  );
}