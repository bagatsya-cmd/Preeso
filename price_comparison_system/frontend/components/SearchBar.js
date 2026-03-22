import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = ['iPhone 15', 'Samsung S24', 'MacBook Air', 'Sony WH-1000XM5', 'Nike Air Max', 'AirPods Pro', 'LG OLED TV'];

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

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

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 680, margin: '0 auto' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Search icon */}
          <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', color: focused ? '#6366f1' : '#6b7280', transition: 'color 0.2s', pointerEvents: 'none' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search products — iPhone, Samsung, Sony..."
            id="search-input"
            style={{
              width: '100%', padding: '16px 50px 16px 50px',
              background: 'rgba(22,22,31,0.9)', border: `1.5px solid ${focused ? '#6366f1' : 'rgba(99,102,241,0.2)'}`,
              borderRadius: 14, color: '#f1f1f5', fontSize: '1rem', fontFamily: 'Inter, sans-serif',
              outline: 'none', transition: 'all 0.2s',
              boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.3)'
            }}
          />
          {/* Ctrl+K hint */}
          {!query && !focused && (
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#6b7280', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }}>Ctrl K</span>
          )}
          {query && (
            <button type="button" onClick={() => setQuery('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          )}
        </div>

        <button type="submit" id="search-btn" disabled={loading} style={{
          padding: '16px 28px', borderRadius: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700,
          fontSize: '0.95rem', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)', transition: 'all 0.2s',
          opacity: loading ? 0.7 : 1
        }}>
          {loading ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : '⚡'}
          {loading ? 'Searching...' : 'Compare'}
        </button>
      </form>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && focused && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
          background: 'rgba(22,22,31,0.97)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 12, overflow: 'hidden', zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)'
        }}>
          {suggestions.map((s, i) => (
            <button key={i} onMouseDown={() => handleSuggestion(s)} style={{
              width: '100%', textAlign: 'left', padding: '12px 18px', background: 'none', border: 'none',
              color: '#d1d5db', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.target.style.background = 'rgba(99,102,241,0.1)'}
              onMouseLeave={e => e.target.style.background = 'none'}
            >
              <span>🔎</span> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}