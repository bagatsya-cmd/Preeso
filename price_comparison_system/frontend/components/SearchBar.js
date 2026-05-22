import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  // Electronics
  'iPhone 15', 'Samsung S24', 'MacBook Air', 'Sony WH-1000XM5', 'AirPods Pro', 'LG OLED TV',
  // Fashion & footwear
  'Nike sneakers', 'Adidas shoes', 'heels', 'dresses', 'kurti', 'kurta', 'saree',
  // Beauty & skincare
  'lipstick', 'skincare', 'foundation', 'moisturizer', 'serum',
  // Accessories
  'handbags', 'sunglasses', 'watches',
];

export default function SearchBar({ onSearch, loading, compact = false, initialValue = '' }) {
  const [query, setQuery] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (query.length > 1) {
      const filtered = SUGGESTIONS.filter(s => s.toLowerCase().includes(query.toLowerCase()));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) { onSearch(query.trim()); setSuggestions([]); }
  };

  const handleSuggestion = (s) => { setQuery(s); onSearch(s); setSuggestions([]); };

  const inputPadding = compact ? '11px 38px 11px 44px' : '16px 48px 16px 52px';
  const btnPadding   = compact ? '11px 18px' : '16px 26px';
  const iconLeft     = compact ? 13 : 18;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 720, margin: compact ? '0' : '0 auto' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: compact ? 8 : 12, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative', zIndex: 10 }}>
          {/* Search icon */}
          <span style={{ position: 'absolute', left: iconLeft, top: '50%', transform: 'translateY(-50%)', fontSize: compact ? '1rem' : '1.1rem', color: focused ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.2s', pointerEvents: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search products across multiple stores…"
            autoFocus={!compact}
            id="search-input"
            aria-label="Search products across multiple stores"
            autoComplete="off"
            style={{
              width: '100%', padding: inputPadding,
              background: focused ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${focused ? '#2563eb' : 'rgba(37,99,235,0.2)'}`,
              borderRadius: compact ? 10 : 14,
              color: 'var(--text-primary)',
              fontSize: compact ? '0.9rem' : '1.05rem',
              fontFamily: 'Poppins, Inter, sans-serif',
              outline: 'none', transition: 'all 0.22s',
              boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.18), 0 4px 20px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
              pointerEvents: 'auto',
              caretColor: '#3b82f6',
            }}
          />
          {/* Ctrl+K hint */}
          {!query && !focused && !compact && (
            <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)', pointerEvents: 'none', fontWeight: 600 }}>⌘K</span>
          )}
          {query && (
            <button type="button" onClick={() => setQuery('')} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          )}
        </div>

        <button type="submit" id="search-btn" disabled={loading} style={{
          padding: btnPadding, borderRadius: compact ? 10 : 14, border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1e40af)',
          color: '#ffffff', fontWeight: 600,
          fontSize: compact ? '0.9rem' : '1rem',
          fontFamily: 'Poppins, Inter, sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'all 0.2s', opacity: loading ? 0.8 : 1,
          boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if(!loading) { e.currentTarget.style.background='linear-gradient(135deg,#1d4ed8,#1e3a8a)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(37,99,235,0.6)'; }}}
        onMouseLeave={e => { if(!loading) { e.currentTarget.style.background='linear-gradient(135deg,#2563eb,#1e40af)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(37,99,235,0.4)'; }}}
        >
          {loading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : null}
          {loading ? 'Searching' : 'Search'}
        </button>
      </form>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && focused && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
          background: 'rgba(13,20,38,0.98)',
          border: '1px solid rgba(37,99,235,0.25)',
          borderRadius: 12, overflow: 'hidden', zIndex: 100,
          boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,99,235,0.1)',
          backdropFilter: 'blur(20px)',
        }}>
          {suggestions.map((s, i) => (
            <button key={i} onMouseDown={() => handleSuggestion(s)} style={{
              width: '100%', textAlign: 'left', padding: '12px 18px',
              background: 'none', border: 'none',
              color: 'var(--text-primary)', cursor: 'pointer',
              fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: i < suggestions.length - 1 ? '1px solid rgba(37,99,235,0.1)' : 'none',
              transition: 'background 0.12s',
              fontFamily: 'Poppins,Inter,sans-serif',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(37,99,235,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}