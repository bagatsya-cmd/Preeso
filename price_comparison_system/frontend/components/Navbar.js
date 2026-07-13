import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

/* ── Preeso inline SVG logo — no file dependency ─────────────────────────── */
function PreesoFullLogo({ height = 36 }) {
  return (
    <svg viewBox="0 0 180 44" height={height} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Preeso">
      {/* Shopping bag */}
      <rect x="2" y="14" width="26" height="28" rx="5" fill="url(#bagGrad)" />
      <path d="M8 14c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="url(#handleGrad)" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Tag */}
      <rect x="8" y="22" width="14" height="12" rx="2.5" fill="white" fillOpacity="0.15" />
      {/* Wordmark */}
      <text x="36" y="32" fontSize="20" fontWeight="800" fill="white" fontFamily="Poppins,Inter,sans-serif" letterSpacing="-0.5">Preeso</text>
      <defs>
        <linearGradient id="bagGrad" x1="2" y1="14" x2="28" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="handleGrad" x1="8" y1="6" x2="24" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PreesoIconLogo({ size = 32 }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Preeso icon">
      <rect width="44" height="44" rx="10" fill="url(#iconBg)" />
      <rect x="4" y="16" width="24" height="26" rx="5" fill="url(#iconBag)" />
      <path d="M9 16c0-4.418 3.134-7 7-7s7 2.582 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.9" />
      <rect x="9" y="23" width="14" height="11" rx="2" fill="white" fillOpacity="0.18" />
      <defs>
        <linearGradient id="iconBg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f1a2e" />
          <stop offset="100%" stopColor="#0d1426" />
        </linearGradient>
        <linearGradient id="iconBag" x1="4" y1="16" x2="28" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export { PreesoFullLogo, PreesoIconLogo };

export default function Navbar() {
  const [user, setUser]       = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token    = localStorage.getItem('preeso_token') || localStorage.getItem('comparex_token');
    const userData = localStorage.getItem('preeso_user')  || localStorage.getItem('comparex_user');
    if (token && userData) setUser(JSON.parse(userData));

    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    ['preeso_token','preeso_user','comparex_token','comparex_user'].forEach(k => localStorage.removeItem(k));
    setUser(null);
    router.push('/');
  };

  return (
    <nav
      className={scrolled ? 'navbar-scrolled' : ''}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? undefined : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(37,99,235,0.15)' : '1px solid transparent',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        padding: '0 24px',
      }}
    >
      <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>

        {/* ── Logo ── */}
        <Link href="/" passHref legacyBehavior>
          <a className="logo-wrapper" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <img src="/preeso-icon.png" alt="P" style={{ height: 32, width: 32, borderRadius: 8 }} />
            <span style={{
              fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '1.85rem',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              paddingRight: '0.05em',
              background: 'linear-gradient(135deg, #ffffff 30%, #60a5fa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Preeso
            </span>
          </a>
        </Link>

        {/* ── Nav links + auth ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>

          {/* Tagline pill — desktop only */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)',
            borderRadius: 20, padding: '5px 12px',
            fontSize: '0.72rem', color: 'var(--text-accent)', fontWeight: 500,
            letterSpacing: '0.02em',
          }}
          className="desktop-nav-pill"
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-electric)', display: 'inline-block', animation: 'pulse 1.8s infinite' }} />
            Smart Prices. Smarter Shopping.
          </div>

          {user && (
            <Link
              href="/wishlists"
              style={{
                color: router.pathname === '/wishlists' ? 'var(--brand-electric)' : 'var(--text-secondary)',
                textDecoration: 'none', fontWeight: 500, fontSize: '0.875rem',
                transition: 'color 0.2s',
              }}
            >
              Wishlist
            </Link>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                boxShadow: '0 0 12px var(--brand-accent-glow)',
              }}>
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link href="/login?tab=register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav-pill { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
