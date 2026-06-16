import { useState, useEffect, useCallback, memo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

// ── CDN priority order for candidate sorting ──────────────────────────────────
const CDN_PRIORITY = ['amazon.in', 'm.media-amazon', 'fkimg.com', 'rukminim', 'reliancedigital', 'myntassets', 'myntraassets'];

function cdnScore(url) {
  if (!url) return -1;
  const lower = url.toLowerCase();
  for (let i = 0; i < CDN_PRIORITY.length; i++) {
    if (lower.includes(CDN_PRIORITY[i])) return CDN_PRIORITY.length - i;
  }
  return 0;
}

/**
 * Build a deduplicated, priority-sorted list of image URL candidates.
 * Tries: product.image → product.imageUrl → store images → thumbnails
 */
function buildCandidates(product) {
  const raw = [
    product.image,
    product.imageUrl,
    ...(product.stores || []).map(s => s.image),
    ...(product.stores || []).map(s => s.thumbnail),
  ];

  // Deduplicate with Set, filter invalids
  const seen = new Set();
  const unique = [];
  for (const u of raw) {
    if (!u || typeof u !== 'string') continue;
    const norm = u.trim().startsWith('//') ? 'https:' + u.trim() : u.trim();
    if (!norm.startsWith('http')) continue;
    if (norm.toLowerCase().startsWith('data:')) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    unique.push(norm);
  }

  // Sort by CDN priority (highest score first)
  return unique.sort((a, b) => cdnScore(b) - cdnScore(a));
}

// ── Platform branding chips — Preeso theme ───────────────────────────────────
const PLATFORM_CHIPS = {
  AJIO:    { label: 'AJIO',    bg: 'rgba(228,0,43,0.18)',    color: '#ff4d6a',  border: 'rgba(228,0,43,0.3)'    },
  Nykaa:   { label: 'NYKAA',  bg: 'rgba(233,30,140,0.18)',  color: '#f472b6',  border: 'rgba(233,30,140,0.3)'  },
  Amazon:  { label: 'AMZ',    bg: 'rgba(255,153,0,0.15)',   color: '#fb923c',  border: 'rgba(255,153,0,0.3)'   },
  Flipkart:{ label: 'FK',     bg: 'rgba(40,116,240,0.18)',  color: '#60a5fa',  border: 'rgba(40,116,240,0.3)'  },
  Myntra:  { label: 'MYNTRA', bg: 'rgba(255,63,108,0.15)',  color: '#fb7185',  border: 'rgba(255,63,108,0.3)'  },
  'Reliance Digital': { label: 'RD', bg: 'rgba(28,150,197,0.15)', color: '#38bdf8', border: 'rgba(28,150,197,0.3)' },
};

function getPlatformChip(storeName) {
  const chip = PLATFORM_CHIPS[storeName];
  if (!chip) return null;
  return (
    <span style={{
      background: chip.bg, color: chip.color, border: `1px solid ${chip.border}`,
      fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4,
      letterSpacing: '0.05em',
    }}>{chip.label}</span>
  );
}


function formatPrice(p) {
  return '₹' + Number(p).toLocaleString('en-IN');
}

/** Pure JSX placeholder — never used as img src, zero onError risk. */
function ImagePlaceholder() {
  return (
    <svg
      width="80" height="80" viewBox="0 0 80 80"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ opacity: 0.22 }}
    >
      <rect x="4" y="4" width="72" height="72" rx="12" fill="#2a2a2a" stroke="#383838" strokeWidth="1.5"/>
      <rect x="14" y="14" width="52" height="36" rx="5" fill="#1c1c1c"/>
      <circle cx="40" cy="32" r="8" fill="#303030"/>
      <path d="M24 50 Q40 38 56 50" stroke="#353535" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <rect x="20" y="62" width="40" height="5" rx="2.5" fill="#2a2a2a"/>
    </svg>
  );
}

// ── Max retries per candidate before advancing to next ────────────────────────
const MAX_RETRIES_PER_CANDIDATE = 2;
// ── Delay before retrying the same candidate (ms) ────────────────────────────
const RETRY_DELAY_MS = 250;
// ── Timeout before giving up on a candidate and advancing (ms) ───────────────
const LOAD_TIMEOUT_MS = 4000;

// Shared wishlist cache for all instances of ProductCard
let wishlistCache = null;
let wishlistPromise = null;

const getWishlistCached = async (token) => {
  if (wishlistCache) return wishlistCache;
  if (wishlistPromise) return wishlistPromise;

  wishlistPromise = axios.get('/api/wishlist', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(res => {
    const list = res.data || [];
    const set = new Set();
    list.forEach(p => {
      if (p._id) set.add(p._id.toString());
      if (p.name) set.add(p.name.trim().toLowerCase());
    });
    wishlistCache = set;
    return set;
  })
  .catch(() => {
    wishlistPromise = null;
    return new Set();
  });

  return wishlistPromise;
};

const ProductCard = memo(function ProductCard({ product, index = 99, inWishlistProp }) {
  const router = useRouter();
  const [inWishlist, setInWishlist]     = useState(inWishlistProp || false);
  const [candidateIdx, setCandidateIdx] = useState(0);   // which URL we're on
  const [retryCount, setRetryCount]     = useState(0);   // retries for current URL
  const [imageLoaded, setImageLoaded]   = useState(false);

  useEffect(() => {
    if (inWishlistProp !== undefined) {
      setInWishlist(inWishlistProp);
      return;
    }
    const token = localStorage.getItem('preeso_token') || localStorage.getItem('comparex_token');
    if (!token) return;

    getWishlistCached(token).then(favs => {
      const prodId = product._id ? product._id.toString() : '';
      const prodName = (product.name || product.baseName || '').trim().toLowerCase();
      if (favs.has(prodId) || favs.has(prodName)) {
        setInWishlist(true);
      }
    });
  }, [product._id, product.name, inWishlistProp]);

  const stores      = product.stores || [];
  const validStores = stores.filter(s => s.price > 0).sort((a, b) => a.price - b.price);
  const lowestStore = validStores[0] || null;

  // Memoised candidate list — stable across renders
  const candidates = buildCandidates(product);
  const currentUrl = candidates[candidateIdx] ?? null;

  // ── 4-second hard timeout per candidate ──────────────────────────────────
  useEffect(() => {
    if (!currentUrl || imageLoaded) return;

    const timer = setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ProductCard] Timeout (${LOAD_TIMEOUT_MS}ms): ${currentUrl}`);
      }
      advanceCandidate();
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [currentUrl, imageLoaded, candidateIdx]);

  // ── Advance to next candidate (or exhaust all) ────────────────────────────
  const advanceCandidate = useCallback(() => {
    setRetryCount(0);
    setImageLoaded(false);
    setCandidateIdx(prev => prev + 1);
  }, []);

  // ── onError: retry same candidate up to MAX_RETRIES, then advance ─────────
  const handleError = useCallback(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ProductCard] Image failed (retry ${retryCount}/${MAX_RETRIES_PER_CANDIDATE}):`, currentUrl);
    }

    if (retryCount < MAX_RETRIES_PER_CANDIDATE) {
      // Retry same candidate after a short delay
      const t = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Force remount by toggling a key via imageLoaded trick — handled by key={} below
        setImageLoaded(false);
      }, RETRY_DELAY_MS);
      return () => clearTimeout(t);
    } else {
      // Exhausted retries — move to next candidate
      setTimeout(advanceCandidate, RETRY_DELAY_MS);
    }
  }, [retryCount, currentUrl, advanceCandidate]);

  const handleLoad = useCallback(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ProductCard] ✅ Loaded:`, currentUrl);
    }
    setImageLoaded(true);
  }, [currentUrl]);

  const toggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('preeso_token') || localStorage.getItem('comparex_token');
    if (!token) {
      alert("Please login or sign up to add products to your wishlist.");
      router.push('/login');
      return;
    }
    try {
      const res = await axios.post(`/api/wishlist/${product._id}`, { product }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const isAdded = res.data.action === 'added';
      setInWishlist(isAdded);

      // Update the local cache set
      if (wishlistCache) {
        const prodId = product._id ? product._id.toString() : '';
        const prodName = (product.name || product.baseName || '').trim().toLowerCase();
        if (isAdded) {
          if (prodId) wishlistCache.add(prodId);
          if (prodName) wishlistCache.add(prodName);
          if (res.data.productId) wishlistCache.add(res.data.productId.toString());
        } else {
          if (prodId) wishlistCache.delete(prodId);
          if (prodName) wishlistCache.delete(prodName);
          if (res.data.productId) wishlistCache.delete(res.data.productId.toString());
        }
      }
    } catch (err) {
      console.error('Failed to toggle wishlist:', err);
    }
  };

  const getDeliveryText = (name) => {
    if (name === 'Amazon')   return 'Tomorrow';
    if (name === 'Flipkart') return '2 Days';
    if (name === 'AJIO')     return '3-5 Days';
    if (name === 'Nykaa')    return '3-5 Days';
    return '3-4 Days';
  };

  // Dev-mode source debugging
  if (process.env.NODE_ENV !== 'production' && product?.stores?.[0]) {
    console.log('[UI] Rendering source:', product.stores[0].storeName, '| title:', product.baseName || product.name);
  }

  return (
    <div
      className="card product-card-hover fade-in"
      onClick={() => lowestStore && window.open(
        lowestStore.link || lowestStore.url, '_blank', 'noopener,noreferrer'
      )}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        cursor: 'pointer',
        border: '1px solid rgba(37,99,235,0.15)',
        borderRadius: 14, overflow: 'hidden',
        background: 'linear-gradient(160deg, #0f1a2e 0%, #0d1426 100%)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Image container: strict 1:1, white background, no layout shift ── */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          background: '#f8faff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '14px 14px 0 0',
        }}>
          {/* Shimmer skeleton shown while image is loading */}
          {currentUrl && !imageLoaded && (
            <div
              className="skeleton"
              style={{ position: 'absolute', inset: 0, borderRadius: 0, zIndex: 1 }}
            />
          )}

          {currentUrl ? (
            <img
              /* key forces remount on each retry/candidate change */
              key={`${candidateIdx}-${retryCount}`}
              src={currentUrl}
              alt={product.name || product.baseName || 'Product'}
              loading={index < 4 ? 'eager' : 'lazy'}
              decoding="async"
              fetchpriority={index < 4 ? 'high' : 'auto'}
              referrerPolicy="no-referrer"
              style={{
                position: 'relative', zIndex: 2,
                maxWidth: '85%', maxHeight: '85%',
                objectFit: 'contain',
                display: 'block',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
              onLoad={handleLoad}
              onMouseEnter={e => e.target.style.transform = 'scale(1.04)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
              onError={handleError}
            />
          ) : (
            // All candidates exhausted — show pure JSX placeholder
            <ImagePlaceholder />
          )}
        </div>

        {/* Discount Badges */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 3 }}>
          {lowestStore?.discount >= 10 && (
            <span style={{
              background: 'var(--success)', color: '#fff',
              padding: '3px 8px', borderRadius: 4,
              fontSize: '0.68rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {lowestStore.discount}% OFF
            </span>
          )}
          {lowestStore?.discount >= 20 && (
            <span style={{
              background: 'var(--brand-accent)', color: '#fff',
              padding: '3px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700
            }}>
              Lowest Today
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={toggleWishlist}
          aria-label="Toggle wishlist"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 3,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(4px)',
            borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'var(--transition)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={inWishlist ? 'var(--error)' : 'none'}
            stroke={inWishlist ? 'var(--error)' : '#fff'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{
        padding: '14px 16px', display: 'flex', flexDirection: 'column',
        flex: 1, borderTop: '1px solid var(--border-color)'
      }}>
        <h3 style={{
          fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-primary)',
          lineHeight: 1.35, marginBottom: 10,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {product.name || product.baseName}
        </h3>

        <div style={{ marginTop: 'auto' }}>
          {lowestStore && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: '1.28rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatPrice(lowestStore.price)}
                </span>
                {lowestStore.originalPrice > lowestStore.price && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    {formatPrice(lowestStore.originalPrice)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 500, marginBottom: 12 }}>
                Free delivery {getDeliveryText(lowestStore.storeName)}
              </div>
            </>
          )}
        </div>

        {/* Platform price rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {validStores.slice(0, 3).map((store, i) => {
            const isBest = lowestStore?.storeName === store.storeName;
            return (
              <a
                key={i}
                href={store.link || store.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: 8, textDecoration: 'none',
                  background: isBest ? 'rgba(37,99,235,0.12)' : 'transparent',
                  border: isBest ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { if (!isBest) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isBest) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'Poppins,Inter,sans-serif' }}>
                    {store.storeName}
                  </span>
                  {isBest && (
                    <span style={{
                      fontSize: '0.6rem',
                      background: 'linear-gradient(135deg,#2563eb,#1e40af)',
                      color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                      letterSpacing: '0.04em', boxShadow: '0 2px 6px rgba(37,99,235,0.4)',
                    }}>BEST</span>
                  )}
                </div>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatPrice(store.price)}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default ProductCard;