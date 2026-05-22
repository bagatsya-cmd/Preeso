import React, { useState } from 'react';
import { useRouter } from 'next/router';

const PremiumProductRow = ({ product }) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  // Helper to determine best deal
  const stores = product.stores || [];
  const validStores = stores.filter(s => s.price > 0).sort((a, b) => a.price - b.price);
  const bestDeal = validStores.length > 0 ? validStores[0] : null;

  // Render dummy delivery info for UI effect if missing
  const getDeliveryText = (storeName) => {
    if (storeName === 'Amazon')   return 'Tomorrow';
    if (storeName === 'Flipkart') return '2 Days';
    if (storeName === 'AJIO')     return '3-5 Days';
    if (storeName === 'Nykaa')    return '3-5 Days';
    return '3-4 Days';
  };

  const getTrustScore = (storeName) => {
    if (storeName === 'Amazon')   return 'High';
    if (storeName === 'Flipkart') return 'High';
    if (storeName === 'AJIO')     return 'High';
    if (storeName === 'Nykaa')    return 'High';
    return 'Medium';
  };

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '20px 24px',
        marginBottom: '16px',
        transition: 'var(--transition)',
        boxShadow: isHovered ? 'var(--shadow-card)' : 'none',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        position: 'relative',
        gap: '32px',
        flexWrap: 'wrap'
      }}
    >
      {/* 1. LEFT: Product Info */}
      <div 
        onClick={() => product._id ? router.push(`/product/${product._id}`) : window.open(bestDeal?.url, '_blank')}
        style={{ flex: '1 1 300px', display: 'flex', gap: '20px', alignItems: 'center', cursor: 'pointer' }}
        title="View Product Details"
      >
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '8px',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          border: '1px solid var(--border-color)'
        }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.baseName || product.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '2rem' }}>📦</span>
          )}
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.3 }}>
            {product.baseName || product.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>{product.category || 'Electronics'}</span>
            <span style={{ width: 4, height: 4, background: 'var(--border-hover)', borderRadius: '50%' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              4.5 (2k+ reviews)
            </span>
          </div>
        </div>
      </div>

      {/* 2. CENTER: Store Comparison Chips */}
      <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
        {validStores.slice(0, 3).map((store, idx) => {
          const isBest = store === bestDeal;
          return (
            <div 
              key={idx} 
              onClick={() => window.open(store.url, '_blank', 'noopener,noreferrer')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderRadius: '6px',
                background: isBest ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                border: `1px solid ${isBest ? 'rgba(34, 197, 94, 0.2)' : 'var(--border-color)'}`,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isBest) e.currentTarget.style.background = 'var(--bg-secondary)';
                else e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
              }}
              onMouseLeave={(e) => {
                if (!isBest) e.currentTarget.style.background = 'transparent';
                else e.currentTarget.style.background = 'rgba(34, 197, 94, 0.05)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', minWidth: '80px' }}>
                  {store.storeName}
                </span>
                {/* AJIO chip */}
                {store.storeName === 'AJIO' && (
                  <span style={{ background: '#000', color: '#fff', fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em' }}>AJIO</span>
                )}
                {/* Nykaa chip */}
                {store.storeName === 'Nykaa' && (
                  <span style={{ background: '#e91e8c', color: '#fff', fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em' }}>NYKAA</span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Delivery: {getDeliveryText(store.storeName)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{store.price.toLocaleString('en-IN')}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: isBest ? 'var(--success)' : 'var(--text-secondary)',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  View <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. RIGHT: Best Deal Highlight & CTA */}
      <div style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '12px' }}>
        {bestDeal ? (
          <>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Best Deal
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)', lineHeight: 1 }}>
                ₹{bestDeal.price.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                on {bestDeal.storeName}
              </div>
            </div>
            
            <a
              href={bestDeal.url}
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 500,
                textDecoration: 'none',
                width: '100%',
                textAlign: 'center',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Get Deal
            </a>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active deals</div>
        )}
      </div>

      {/* Badges container (Absolute) */}
      <div style={{ position: 'absolute', top: '-10px', left: '24px', display: 'flex', gap: '8px' }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Fastest Delivery
        </div>
        {product.discount > 10 && (
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--success)' }}>
            Price Drop
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumProductRow;
