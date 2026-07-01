import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';

/* ── Preeso inline SVG wordmark (no file dep) ─────────────────────────────── */
function PreesoWordmark() {
  return (
    <span style={{
      fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: '2.5rem',
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
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab]           = useState(router.query.tab === 'register' ? 'register' : 'login');
  const [form, setForm]         = useState({ name: '', email: '', password: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  
  // New States for Password Toggle & Terms Checkbox
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed]             = useState(false);

  useEffect(() => {
    if (router.query.tab === 'register') setTab('register');
  }, [router.query.tab]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Prevent account creation unless checkbox is agreed
    if (tab === 'register' && !agreed) {
      setError('You must agree to the Terms & Conditions and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload  = tab === 'login' ? { email: form.email, password: form.password } : form;
      const res = await axios.post(endpoint, payload);
      // Store under both preeso_ and legacy comparex_ keys for compatibility
      localStorage.setItem('preeso_token', res.data.token);
      localStorage.setItem('preeso_user',  JSON.stringify(res.data.user));
      localStorage.setItem('comparex_token', res.data.token);
      localStorage.setItem('comparex_user',  JSON.stringify(res.data.user));
      if (tab === 'register') setSuccess('Account created! Redirecting…');
      setTimeout(() => router.push('/'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(37,99,235,0.2)',
    borderRadius: 10, color: '#f0f4ff',
    fontSize: '0.9rem', fontFamily: 'Poppins,Inter,sans-serif',
    outline: 'none', transition: 'all 0.2s',
  };

  return (
    <>
      <Head>
        <title>{tab === 'login' ? 'Login' : 'Sign Up'} | Preeso</title>
        <meta name="description" content="Sign in to Preeso and start comparing prices across all major Indian e-commerce platforms." />
        <link rel="canonical" href="https://www.preeso.co.in/login" />
        <meta property="og:title" content={tab === 'login' ? 'Login | Preeso' : 'Sign Up | Preeso'} />
        <meta property="og:description" content="Sign in to Preeso and start comparing prices across all major Indian e-commerce platforms." />
        <meta property="og:url" content="https://www.preeso.co.in/login" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.preeso.co.in/preeso-icon.png" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '24px 16px', position: 'relative', overflow: 'hidden',
        background: '#080e1f',
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 30% 0%, rgba(37,99,235,0.15) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 100%, rgba(99,102,241,0.1) 0%, transparent 50%)
        `,
      }}>
        {/* Grid bg */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>

          {/* Logo (Compact Spacing) */}
          <Link href="/" passHref legacyBehavior>
            <a className="logo-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20, textDecoration: 'none', cursor: 'pointer' }}>
              <img src="/preeso-icon.png" alt="P" style={{ height: 40, width: 40, borderRadius: 10 }} />
              <PreesoWordmark />
            </a>
          </Link>

          {/* Card (Compact Padding & Height) */}
          <div style={{
            background: 'rgba(13,20,38,0.9)',
            border: '1px solid rgba(37,99,235,0.2)',
            borderRadius: 20, padding: '28px 24px 20px',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,99,235,0.1)',
          }}>

            {/* Tabs (Compact Spacing) */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
              {['login', 'register'].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
                  flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.875rem', fontFamily: 'Poppins,Inter,sans-serif',
                  transition: 'all 0.25s',
                  background: tab === t ? 'linear-gradient(135deg, #2563eb, #1e40af)' : 'transparent',
                  color: tab === t ? 'white' : '#64748b',
                  boxShadow: tab === t ? '0 4px 15px rgba(37,99,235,0.35)' : 'none',
                }}>
                  {t === 'login' ? 'Login' : 'Sign Up'}
                </button>
              ))}
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Poppins,sans-serif', marginBottom: 4 }}>
              {tab === 'login' ? 'Welcome back 👋' : 'Create your account'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 16 }}>
              {tab === 'login'
                ? 'Compare prices and track your wishlist on Preeso'
                : 'Join Preeso to find the best deals across all platforms'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>NAME</label>
                  <input
                    type="text" value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Your name" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.2)'; }}
                    onBlur={e =>  { e.target.style.borderColor='rgba(37,99,235,0.2)'; e.target.style.boxShadow='none'; }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>EMAIL</label>
                <input
                  type="email" value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="you@example.com" required style={inputStyle}
                  onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.2)'; }}
                  onBlur={e =>  { e.target.style.borderColor='rgba(37,99,235,0.2)'; e.target.style.boxShadow='none'; }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    placeholder="••••••••" required 
                    style={{ ...inputStyle, paddingRight: '46px' }}
                    onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.2)'; }}
                    onBlur={e =>  { e.target.style.borderColor='rgba(37,99,235,0.2)'; e.target.style.boxShadow='none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      zIndex: 10,
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Required Checkbox for Signup */}
              {tab === 'register' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    id="agree-checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    required
                    style={{ marginTop: 3, cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <label htmlFor="agree-checkbox" style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4, cursor: 'pointer', userSelect: 'none' }}>
                    I agree to the{' '}
                    <Link href="/terms" passHref legacyBehavior>
                      <a target="_blank" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Terms & Conditions</a>
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" passHref legacyBehavior>
                      <a target="_blank" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>
                    </Link>
                  </label>
                </div>
              )}

              {error   && <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: '0.8rem' }}>❌ {error}</div>}
              {success && <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#34d399', fontSize: '0.8rem' }}>✅ {success}</div>}

              <button
                type="submit" id="auth-submit-btn" disabled={loading}
                style={{
                  padding: '12px', marginTop: 4,
                  background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1e40af)',
                  border: 'none', borderRadius: 12, color: 'white',
                  fontWeight: 700, fontSize: '0.92rem', cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Poppins,Inter,sans-serif',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
                  transition: 'all 0.2s', letterSpacing: '0.02em',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 28px rgba(37,99,235,0.6)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,99,235,0.4)'; }}
              >
                 {loading ? 'Please wait…' : tab === 'login' ? '→ Login to Preeso' : '→ Create Account'}
              </button>
            </form>

            {/* Subtle Trust Message below Signup Button */}
            {tab === 'register' && (
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.72rem', marginTop: 10, lineHeight: 1.4 }}>
                Secure account creation. Your information is protected and never sold.
              </p>
            )}

            <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.8rem', color: '#475569' }}>
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
              >
                {tab === 'login' ? 'Sign up' : 'Login'}
              </button>
            </p>

            {/* Auth Page Footer Links inside the card */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.75rem',
            }}>
              <Link href="/privacy" passHref legacyBehavior>
                <a style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color='#f0f4ff'} onMouseLeave={e => e.target.style.color='#64748b'}>Privacy Policy</a>
              </Link>
              <span style={{ color: '#334155' }}>•</span>
              <Link href="/terms" passHref legacyBehavior>
                <a style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color='#f0f4ff'} onMouseLeave={e => e.target.style.color='#64748b'}>Terms & Conditions</a>
              </Link>
              <span style={{ color: '#334155' }}>•</span>
              <Link href="/contact" passHref legacyBehavior>
                <a style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color='#f0f4ff'} onMouseLeave={e => e.target.style.color='#64748b'}>Contact</a>
              </Link>
            </div>

          </div>

          <Link href="/" style={{ display: 'block', textAlign: 'center', marginTop: 18, color: '#475569', textDecoration: 'none', fontSize: '0.8rem', transition: 'color 0.2s' }}
            onMouseEnter={e => e.target.style.color='var(--brand-electric)'}
            onMouseLeave={e => e.target.style.color='#475569'}
          >
            ← Back to Preeso
          </Link>
        </div>
      </div>
    </>
  );
}