import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';

/* ── Pricio inline SVG wordmark (no file dep) ─────────────────────────────── */
function PricioWordmark() {
  return (
    <span style={{
      fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: '2.5rem',
      fontWeight: 800,
      letterSpacing: '-0.04em',
      background: 'linear-gradient(135deg, #ffffff 30%, #60a5fa 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }}>
      Pricio
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab]       = useState(router.query.tab === 'register' ? 'register' : 'login');
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (router.query.tab === 'register') setTab('register');
  }, [router.query.tab]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload  = tab === 'login' ? { email: form.email, password: form.password } : form;
      const res = await axios.post(endpoint, payload);
      // Store under both pricio_ and legacy comparex_ keys for compatibility
      localStorage.setItem('pricio_token', res.data.token);
      localStorage.setItem('pricio_user',  JSON.stringify(res.data.user));
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
        <title>{tab === 'login' ? 'Login' : 'Sign Up'} — Pricio</title>
        <meta name="description" content="Sign in to Pricio and start comparing prices across all major Indian e-commerce platforms." />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden',
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

          {/* Logo */}
          <Link href="/" className="logo-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: 40, textDecoration: 'none', cursor: 'pointer' }}>
            <PricioWordmark />
          </Link>

          {/* Card */}
          <div style={{
            background: 'rgba(13,20,38,0.9)',
            border: '1px solid rgba(37,99,235,0.2)',
            borderRadius: 24, padding: '36px 32px',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,99,235,0.1)',
          }}>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 32 }}>
              {['login', 'register'].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
                  flex: 1, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer',
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

            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Poppins,sans-serif', marginBottom: 6 }}>
              {tab === 'login' ? 'Welcome back 👋' : 'Create your account'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 28 }}>
              {tab === 'login'
                ? 'Compare prices and track your wishlist on Pricio'
                : 'Join Pricio to find the best deals across all platforms'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 7, fontWeight: 600, letterSpacing: '0.04em' }}>NAME</label>
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
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 7, fontWeight: 600, letterSpacing: '0.04em' }}>EMAIL</label>
                <input
                  type="email" value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="you@example.com" required style={inputStyle}
                  onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.2)'; }}
                  onBlur={e =>  { e.target.style.borderColor='rgba(37,99,235,0.2)'; e.target.style.boxShadow='none'; }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 7, fontWeight: 600, letterSpacing: '0.04em' }}>PASSWORD</label>
                <input
                  type="password" value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="••••••••" required style={inputStyle}
                  onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.2)'; }}
                  onBlur={e =>  { e.target.style.borderColor='rgba(37,99,235,0.2)'; e.target.style.boxShadow='none'; }}
                />
              </div>

              {error   && <div style={{ padding: '11px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: '0.82rem' }}>❌ {error}</div>}
              {success && <div style={{ padding: '11px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#34d399', fontSize: '0.82rem' }}>✅ {success}</div>}

              <button
                type="submit" id="auth-submit-btn" disabled={loading}
                style={{
                  padding: '14px', marginTop: 6,
                  background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1e40af)',
                  border: 'none', borderRadius: 12, color: 'white',
                  fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Poppins,Inter,sans-serif',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
                  transition: 'all 0.2s', letterSpacing: '0.02em',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 28px rgba(37,99,235,0.6)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,99,235,0.4)'; }}
              >
                {loading ? 'Please wait…' : tab === 'login' ? '→ Login to Pricio' : '→ Create Account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.82rem', color: '#475569' }}>
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
              >
                {tab === 'login' ? 'Sign up' : 'Login'}
              </button>
            </p>
          </div>

          <Link href="/" style={{ display: 'block', textAlign: 'center', marginTop: 22, color: '#475569', textDecoration: 'none', fontSize: '0.8rem', transition: 'color 0.2s' }}
            onMouseEnter={e => e.target.style.color='var(--brand-electric)'}
            onMouseLeave={e => e.target.style.color='#475569'}
          >
            ← Back to Pricio
          </Link>
        </div>
      </div>
    </>
  );
}