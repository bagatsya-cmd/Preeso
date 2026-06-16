import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';

/* ── Preeso inline SVG icon (used in hero badge) ─────────────────────────── */
function PreesoIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="10" fill="url(#hiBg)" />
      <rect x="4" y="16" width="24" height="26" rx="5" fill="url(#hiBag)" />
      <path d="M9 16c0-4.418 3.134-7 7-7s7 2.582 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.9" />
      <rect x="9" y="23" width="14" height="11" rx="2" fill="white" fillOpacity="0.18" />
      <defs>
        <linearGradient id="hiBg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id="hiBag" x1="4" y1="16" x2="28" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Additive merge helper (Phase 11 — preserved) ───────────────────────── */
function mergeProductsList(prev, incoming) {
  const map = new Map();
  const getProductKey = (product) => {
    if (product._id) return product._id;
    if (product.bestDeal?.url) return product.bestDeal.url;
    if (product.stores?.[0]?.url) return product.stores[0].url;
    const title    = product.title || product.baseName || product.name || '';
    const platform = product.platform || product.stores?.[0]?.storeName || '';
    return `${title.trim()}-${platform.trim()}`.toLowerCase();
  };

  prev.forEach(product => {
    const key = getProductKey(product);
    if (key) map.set(key, product);
  });

  incoming.forEach(product => {
    const key = getProductKey(product);
    if (!key) return;
    if (map.has(key)) {
      const existing     = map.get(key);
      const mergedStores = [...(existing.stores || [])];
      (product.stores || []).forEach(newStore => {
        const idx = mergedStores.findIndex(s => s.storeName === newStore.storeName);
        if (idx >= 0) {
          if (newStore.price > 0 && (mergedStores[idx].price <= 0 || newStore.price < mergedStores[idx].price)) {
            mergedStores[idx] = newStore;
          }
        } else {
          mergedStores.push(newStore);
        }
      });
      map.set(key, {
        ...existing, ...product, stores: mergedStores,
        lowestPrice: mergedStores.length > 0
          ? Math.min(...mergedStores.map(s => s.price).filter(p => p > 0))
          : existing.lowestPrice,
      });
    } else {
      map.set(key, product);
    }
  });

  return Array.from(map.values());
}

/* ── Platform display config ─────────────────────────────────────────────── */
const PLATFORM_CONFIG = {
  Amazon:           { color: '#ff9900', emoji: '🛒' },
  Flipkart:         { color: '#2874f0', emoji: '🏪' },
  Myntra:           { color: '#ff3f6c', emoji: '👗' },
  'Reliance Digital': { color: '#1c96c5', emoji: '📱' },
  AJIO:             { color: '#e4002b', emoji: '🎁' },
  Nykaa:            { color: '#e91e8c', emoji: '💄' },
};

export default function Home() {
  const [products, setProducts]       = useState([]);
  const [trending, setTrending]       = useState([]);
  const [searchState, setSearchState] = useState('idle');
  const eventSourceRef   = useRef(null);
  const lastSearchQueryRef = useRef(null);
  const [searched, setSearched]       = useState(false);
  const [streamStatus, setStreamStatus] = useState({});
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [liveCount, setLiveCount]     = useState(0);
  const router = useRouter();

  // Filters
  const [sortBy, setSortBy]               = useState('bestPrice');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [priceRange, setPriceRange]       = useState('All');

  useEffect(() => {
    console.log('[COMPONENT MOUNTED]');
    return () => console.log('[COMPONENT UNMOUNTED]');
  }, []);

  useEffect(() => {
    if (router.isReady && router.query.q && !searched) {
      handleSearch(router.query.q, true);
    }
  }, [router.isReady, router.query.q]);

  useEffect(() => {
    if (router.isReady && router.pathname === '/' && !router.query.q && searched) {
      console.log('[RESET TRIGGERED] pathname change or query reset');
      setProducts([]);
      setSearchState('idle');
      setSearched(false);
      setStreamStatus({});
      setLiveCount(0);
      setPlatformFilter('All');
      setPriceRange('All');
      setSortBy('bestPrice');

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [router.isReady, router.pathname, router.query.q, searched]);

  useEffect(() => {
    axios.get('/api/products/trending').then(r => setTrending(r.data)).catch(() => {});
  }, []);

  const initStream = (query, isReconnect = false) => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }

    setSearchState(isReconnect ? 'reconnecting' : 'connecting');
    if (!isReconnect) {
      console.log('[RESET TRIGGERED] initStream fresh search starting');
      setProducts([]);
      setLiveCount(0);
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    const eventSource = new EventSource(`${apiBase}/api/stream/search?q=${encodeURIComponent(query)}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setSearchState('streaming');

    eventSource.onmessage = (event) => {
      console.log('[RAW EVENT]', event.data);
      if (event.data === 'ping') return;
      try {
        const data = JSON.parse(event.data);
        console.log('[PARSED DATA]', data);
        console.log('[EVENT TYPE]', data.type);
        console.log('[EVENT PRODUCTS]', data.products);
        console.log('[EVENT PRODUCTS LENGTH]', data.products?.length);

        switch (data.type) {
          case 'scraper-status':
            setStreamStatus(prev => ({ ...prev, [data.store]: data.status }));
            break;

          case 'partial-results':
            setProducts(prev => {
              console.log('[PREV STATE LENGTH]', prev.length);
              const incoming = Array.isArray(data.products) ? data.products : [];
              console.log('[INCOMING LENGTH]', incoming.length);
              const merged = mergeProductsList(prev, incoming);
              console.log('[MERGED LENGTH]', merged.length);
              console.log('[MERGED DATA]', merged);
              setLiveCount(merged.length);
              return merged;
            });
            break;

          case 'scraper-success':
            setStreamStatus(prev => ({ ...prev, [data.store]: `✅ ${data.resultsCount} results (${data.elapsed}s)` }));
            break;

          case 'matching-status':
            setStreamStatus(prev => ({ ...prev, System: data.progress }));
            break;

          case 'completed':
          case 'complete':
            console.log('[FRONTEND] stream complete');
            setSearchState('completed');
            setStreamStatus({ System: `Found ${data.totalUnique || 0} products` });
            setLiveCount(data.totalUnique || 0);
            eventSource.close();
            break;

          case 'error':
            setSearchState('error');
            setStreamStatus({ System: data.message });
            eventSource.close();
            break;
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setSearchState('reconnecting');
      setTimeout(() => {
        if (searchState !== 'completed' && searchState !== 'error') initStream(query, true);
      }, 2000);
    };
  };

  const handleSearch = (query, skipUrlUpdate = false) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    if (lastSearchQueryRef.current === cleanQuery && searchState !== 'idle') return;
    
    console.log('[SEARCH START]', cleanQuery);
    lastSearchQueryRef.current = cleanQuery;
    setSearched(true);
    initStream(cleanQuery, false);
    setIsMobileDrawerOpen(false);
    if (!skipUrlUpdate) router.push({ query: { ...router.query, q: cleanQuery } }, undefined, { shallow: true });
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const isSearchActive  = ['connecting','streaming','reconnecting'].includes(searchState);
  const isLoading       = isSearchActive && products.length === 0;
  const displayProducts = searched ? products : trending;

  useEffect(() => {
    console.log('[DEBUG] products state updated', products.length);
  }, [products]);

  useEffect(() => {
    if (!isLoading && searched && products.length > 0) {
      console.log('[FRONTEND] loading false');
    }
  }, [isLoading, searched, products.length]);

  /* ── Filtering ── */
  const priceFiltered = useMemo(() => {
    if (priceRange === 'All') return displayProducts;
    return displayProducts.filter(p => {
        if (!p.stores) return false;
        const validStores = p.stores.filter(s => s.price > 0).sort((a,b) => a.price - b.price);
        if (!validStores.length) return false;
        const minPrice = validStores[0].price;
        if (priceRange === 'Under ₹10,000') return minPrice < 10000;
        if (priceRange === '₹10,000 - ₹30,000') return minPrice >= 10000 && minPrice <= 30000;
        if (priceRange === 'Over ₹30,000') return minPrice > 30000;
        return true;
    });
  }, [displayProducts, priceRange]);

  const filtered = useMemo(() => {
    if (platformFilter === 'All') return priceFiltered;
    return priceFiltered.filter(p => p.stores?.some(s => s.storeName === platformFilter && s.price > 0));
  }, [priceFiltered, platformFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const getMin = p => { const v = (p.stores||[]).filter(s=>s.price>0); return v.length ? Math.min(...v.map(s=>s.price)) : 99999999; };
      const getMaxDisc = p => Math.max(...(p.stores||[]).map(s=>s.discount||0));
      if (sortBy === 'bestPrice') return getMin(a) - getMin(b);
      if (sortBy === 'highPrice') return getMin(b) - getMin(a);
      if (sortBy === 'discount')  return getMaxDisc(b) - getMaxDisc(a);
      return 0;
    });
  }, [filtered, sortBy]);

  const storeCounts = useMemo(() => {
    const counts = { All: priceFiltered.length };
    ['Amazon', 'Flipkart', 'Reliance Digital', 'AJIO', 'Nykaa', 'Myntra'].forEach(plat => {
      counts[plat] = priceFiltered.filter(p => p.stores?.some(s => s.storeName === plat && s.price > 0)).length;
    });
    return counts;
  }, [priceFiltered]);

  /* ── Filter sidebar content ── */
  const FilterContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Sort */}
      <div>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-accent)', marginBottom: 14, fontWeight: 600 }}>
          Sort By
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { value: 'bestPrice', label: 'Lowest Price' },
            { value: 'highPrice', label: 'Highest Price' },
            { value: 'discount',  label: 'Biggest Discount' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setSortBy(opt.value)} style={{
              textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: sortBy === opt.value ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: sortBy === opt.value ? 'var(--brand-electric)' : 'var(--text-secondary)',
              fontWeight: sortBy === opt.value ? 600 : 400, fontSize: '0.875rem',
              fontFamily: 'Poppins,Inter,sans-serif',
              transition: 'var(--transition-fast)',
              borderLeft: sortBy === opt.value ? '2px solid var(--brand-accent)' : '2px solid transparent',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Platform */}
      <div>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-accent)', marginBottom: 14, fontWeight: 600 }}>
          Platform
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {['All', 'Amazon', 'Flipkart', 'Reliance Digital', 'AJIO', 'Nykaa', 'Myntra'].map(plat => {
            const cfg = PLATFORM_CONFIG[plat];
            const cnt = storeCounts[plat] || 0;
            const active = platformFilter === plat;
            return (
              <button key={plat} onClick={() => setPlatformFilter(plat)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
                fontFamily: 'Poppins,Inter,sans-serif', fontSize: '0.875rem',
                fontWeight: active ? 600 : 400, transition: 'var(--transition-fast)',
                borderLeft: active ? `2px solid ${cfg?.color || 'var(--brand-accent)'}` : '2px solid transparent',
              }}
              onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {cfg?.emoji && <span style={{ fontSize: '0.9rem' }}>{cfg.emoji}</span>}
                  {plat === 'All' ? '🌐 All Platforms' : plat}
                </span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                  background: active ? (cfg?.color || 'var(--brand-accent)') + '30' : 'rgba(255,255,255,0.07)',
                  color: active ? (cfg?.color || 'var(--brand-electric)') : 'var(--text-muted)',
                }}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-accent)', marginBottom: 14, fontWeight: 600 }}>
          Price Range
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {['All', 'Under ₹10,000', '₹10,000 - ₹30,000', 'Over ₹30,000'].map(range => (
            <button key={range} onClick={() => setPriceRange(range)} style={{
              textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: priceRange === range ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: priceRange === range ? 'var(--brand-electric)' : 'var(--text-secondary)',
              fontWeight: priceRange === range ? 600 : 400, fontSize: '0.875rem',
              fontFamily: 'Poppins,Inter,sans-serif', transition: 'var(--transition-fast)',
              borderLeft: priceRange === range ? '2px solid var(--brand-accent)' : '2px solid transparent',
            }}>
              {range}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Hero categories ── */
  const electronicsCategories = ['iPhone 15', 'Samsung S25', 'MacBook Air', 'Headphones', 'Smartwatches'];
  const fashionCategories     = ["Women's Kurtis", 'Handbags', 'Sneakers', 'Makeup', 'Skincare', 'Sarees'];

  return (
    <>
      <Head>
        <title>Preeso — Smart Prices. Smarter Shopping.</title>
        <meta name="description" content="Preeso compares prices across Amazon, Flipkart, Myntra, AJIO, Nykaa and more — find the best deals in real time." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Preeso — Smart Prices. Smarter Shopping." />
        <meta property="og:description" content="Compare product prices across all major Indian e-commerce platforms instantly." />
        <link rel="icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <style>{`
          .desktop-only { display: block; }
          .mobile-only  { display: none; }
          .mobile-bottom-bar {
            position: fixed; bottom: 0; left: 0; right: 0;
            background: rgba(8,14,31,0.96); backdrop-filter: blur(20px);
            border-top: 1px solid rgba(37,99,235,0.15);
            padding: 12px 16px; z-index: 100; display: none;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
          }
          .mobile-drawer {
            position: fixed; bottom: 0; left: 0; right: 0; top: auto;
            background: var(--bg-secondary);
            border-top-left-radius: 24px; border-top-right-radius: 24px;
            z-index: 200; max-height: 85vh; overflow-y: auto; padding: 24px;
            transform: translateY(100%);
            transition: transform 0.35s cubic-bezier(0.16,1,0.3,1);
            box-shadow: 0 -16px 48px rgba(0,0,0,0.6);
            border: 1px solid rgba(37,99,235,0.15);
          }
          .mobile-drawer.open { transform: translateY(0); }
          .mobile-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.7);
            z-index: 150; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
          }
          .mobile-overlay.open { opacity: 1; pointer-events: auto; }

          .hero-bg-grid {
            background-image: linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px);
            background-size: 48px 48px;
          }

          @media (max-width: 768px) {
            .desktop-only  { display: none !important; }
            .mobile-only   { display: block !important; }
            .mobile-bottom-bar { display: flex; align-items: center; gap: 12px; }
            .content-area  { padding-bottom: 80px !important; }
            .desktop-nav-pill { display: none !important; }
          }

          @keyframes floatBadge {
            0%,100% { transform: translateY(0); }
            50%      { transform: translateY(-4px); }
          }

          .platform-pill:hover {
            background: rgba(37,99,235,0.15) !important;
            border-color: rgba(37,99,235,0.4) !important;
            transform: translateY(-2px);
          }

          .status-chip {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 12px;
            background: rgba(15,26,46,0.8);
            border: 1px solid var(--border-color);
            border-radius: 20px; font-size: 0.72rem;
            color: var(--text-secondary);
            backdrop-filter: blur(8px);
          }

          .sidebar-panel {
            background: rgba(15,26,46,0.7);
            border: 1px solid rgba(37,99,235,0.12);
            border-radius: 16px;
            padding: 24px 20px;
            backdrop-filter: blur(12px);
          }
        `}</style>
      </Head>

      <Navbar />
      <div style={{ height: 66 }} />

      {/* ── Background orbs (fixed) ── */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* ════════════════════ HOMEPAGE (unsearched) ════════════════════ */}
      {!searched && (
        <>
          <main className="hero-bg-grid" style={{
            minHeight: 'calc(100vh - 66px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 24px', position: 'relative',
          }}>
            <div style={{ maxWidth: 740, width: '100%', textAlign: 'center', marginBottom: 100 }}>



            {/* Headline */}
            <h1 style={{
              fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', fontWeight: 900,
              letterSpacing: '-0.04em', marginBottom: 18, lineHeight: 1.15,
              color: 'var(--text-primary)',
            }}>
              Smart Prices<br />
              <span className="text-gradient">Smarter Shopping</span>
            </h1>

            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-secondary)',
              marginBottom: 44, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 44px',
            }}>
              Preeso searches Amazon, Flipkart, Myntra, AJIO, Nykaa & more in real time
              so you always pay the lowest price.
            </p>

            {/* Search bar */}
            <SearchBar onSearch={handleSearch} loading={isSearchActive} initialValue={router.query?.q || ''} />

            {/* Platform trust strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 32 }}>
              {Object.entries(PLATFORM_CONFIG).map(([name, { color, emoji }]) => (
                <span key={name} className="platform-pill" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 13px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '0.78rem', color: 'var(--text-secondary)',
                  cursor: 'default', transition: 'var(--transition)',
                }}>
                  {emoji} {name}
                </span>
              ))}
            </div>

            {/* Quick search pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 44 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 9 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', minWidth: 80, fontWeight: 500 }}>📱 Electronics:</span>
                {electronicsCategories.map(cat => (
                  <button key={cat} onClick={() => handleSearch(cat)} style={{
                    background: 'rgba(37,99,235,0.08)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    borderRadius: 20, padding: '5px 14px',
                    fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'var(--transition)', fontFamily: 'Poppins,Inter,sans-serif',
                  }}
                  onMouseEnter={e => { e.target.style.color='var(--brand-electric)'; e.target.style.borderColor='rgba(37,99,235,0.5)'; e.target.style.background='rgba(37,99,235,0.15)'; }}
                  onMouseLeave={e => { e.target.style.color='var(--text-secondary)'; e.target.style.borderColor='rgba(37,99,235,0.2)'; e.target.style.background='rgba(37,99,235,0.08)'; }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 9 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', minWidth: 80, fontWeight: 500 }}>👗 Fashion:</span>
                {fashionCategories.map(cat => (
                  <button key={cat} onClick={() => handleSearch(cat)} style={{
                    background: 'rgba(236,72,153,0.08)',
                    border: '1px solid rgba(236,72,153,0.2)',
                    borderRadius: 20, padding: '5px 14px',
                    fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'var(--transition)', fontFamily: 'Poppins,Inter,sans-serif',
                  }}
                  onMouseEnter={e => { e.target.style.color='#ec4899'; e.target.style.borderColor='rgba(236,72,153,0.5)'; e.target.style.background='rgba(236,72,153,0.15)'; }}
                  onMouseLeave={e => { e.target.style.color='var(--text-secondary)'; e.target.style.borderColor='rgba(236,72,153,0.2)'; e.target.style.background='rgba(236,72,153,0.08)'; }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 56 }}>
              {[['6', 'Platforms'], ['Real‑time', 'Prices'], ['10K+', 'Happy Users']].map(([num, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-electric)', letterSpacing: '-0.03em' }}>{num}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
            </div>
          </main>
          <Footer />
        </>
      )}

      {/* ════════════════════ SEARCH RESULTS ════════════════════ */}
      {searched && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 66px)' }}>

          {/* Sticky search header */}
          <div className="desktop-only" style={{
            position: 'sticky', top: 66, zIndex: 50,
            background: 'rgba(8,14,31,0.92)', backdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(37,99,235,0.12)',
            padding: '14px 24px',
          }}>
            <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', gap: 20, alignItems: 'center' }}>

              <div style={{ flex: 1 }}>
                <SearchBar onSearch={handleSearch} loading={isSearchActive} compact initialValue={router.query?.q || ''} />
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="content-area" style={{
            maxWidth: 1440, margin: '0 auto', width: '100%',
            display: 'flex', gap: 28, padding: '28px 24px', flex: 1, alignItems: 'flex-start',
          }}>

            {/* Sidebar */}
            <aside className="desktop-only sidebar-panel" style={{ width: 256, flexShrink: 0, position: 'sticky', top: 160 }}>
              <FilterContent />
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, minWidth: 0 }}>

              {/* Mobile top bar */}
              <div className="mobile-only" style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>{sorted.length} results</span>
              </div>

              {/* Stream status chips */}
              {Object.keys(streamStatus).length > 0 && searchState !== 'idle' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {Object.entries(streamStatus).map(([store, status]) => (
                    <div key={store} className="status-chip">
                      {isSearchActive && status.toLowerCase().includes('search') && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-electric)', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                      )}
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {status.toLowerCase().includes('search') ? `Searching ${store}…` : `${store}: ${status}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Live count bar */}
              {isSearchActive && liveCount > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
                  padding: '10px 16px',
                  background: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.2)',
                  borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-secondary)',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-electric)', flexShrink: 0, animation: 'pulse 1.2s ease-in-out infinite' }} />
                  <span><strong style={{ color: 'var(--text-primary)' }}>{liveCount}</strong> products found so far — still searching…</span>
                </div>
              )}

              {/* Results header */}
              {searchState === 'completed' && sorted.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{sorted.length}</span> results found
                  </span>
                  <span style={{
                    fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20,
                    background: 'var(--success-bg)', color: 'var(--success)',
                    border: '1px solid rgba(16,185,129,0.25)', fontWeight: 600,
                  }}>
                    ✓ Best prices highlighted
                  </span>
                </div>
              )}

              {/* Debug render logs */}
              {console.log('[DEBUG] rendering grid with', sorted.length)}
              {console.log('[DEBUG] displayProducts.length:', displayProducts.length)}
              {console.log('[DEBUG] priceFiltered.length:', priceFiltered.length)}
              {console.log('[DEBUG] filtered.length:', filtered.length)}

              {/* Product grid */}
              <div className="products-grid">
                {sorted.map((p, idx) => {
                  console.log('[DEBUG] rendering product', p.title || p.baseName);
                  try {
                    return <ProductCard key={p._id || p.baseName || idx} product={p} index={idx} />;
                  } catch (err) {
                    console.error('[DEBUG] ProductCard crashed on:', p, err);
                    return <div key={`err-${idx}`}>Card Crash</div>;
                  }
                })}
                {isLoading && Array(Math.max(0, 8 - sorted.length)).fill(0).map((_, i) => (
                  <div key={`sk-${i}`} className="skeleton" style={{ height: 380, borderRadius: 12 }} />
                ))}
              </div>

              {/* Empty state */}
              {!isLoading && sorted.length === 0 && (
                <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.5 }}>🔍</div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 10, fontWeight: 700 }}>
                    No products found
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 24 }}>
                    Try adjusting your filters or search for something else.
                  </p>
                  <button onClick={() => { setPlatformFilter('All'); setPriceRange('All'); }} style={{
                    padding: '10px 22px', borderRadius: 10, border: '1px solid var(--border-color)',
                    background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
                    fontFamily: 'Poppins,Inter,sans-serif', fontWeight: 500,
                  }}>
                    Clear filters
                  </button>
                </div>
              )}
            </main>
          </div>

          {/* Mobile bottom bar */}
          <div className="mobile-bottom-bar">
            <div style={{ flex: 1 }}>
              <SearchBar onSearch={handleSearch} loading={isSearchActive} compact initialValue={router.query?.q || ''} />
            </div>
            <button onClick={() => setIsMobileDrawerOpen(true)} style={{
              background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
              borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--brand-electric)', cursor: 'pointer',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            </button>
          </div>

          {/* Mobile filter drawer */}
          <div className={`mobile-overlay ${isMobileDrawerOpen ? 'open' : ''}`} onClick={() => setIsMobileDrawerOpen(false)} />
          <div className={`mobile-drawer ${isMobileDrawerOpen ? 'open' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Filters & Sort</h2>
              <button onClick={() => setIsMobileDrawerOpen(false)} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <FilterContent />
            <button onClick={() => setIsMobileDrawerOpen(false)} style={{
              width: '100%', marginTop: 28, padding: '14px', borderRadius: 12,
              background: 'var(--brand-gradient)', border: 'none', color: 'white',
              fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              fontFamily: 'Poppins,Inter,sans-serif', boxShadow: '0 4px 20px var(--brand-accent-glow)',
            }}>
              Show {sorted.length} Results
            </button>
          </div>
          <Footer />
        </div>
      )}
    </>
  );
}