import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState(router.query.tab === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      const payload = tab === 'login' ? { email: form.email, password: form.password } : form;
      const res = await axios.post(endpoint, payload);
      localStorage.setItem('comparex_token', res.data.token);
      localStorage.setItem('comparex_user', JSON.stringify(res.data.user));
      if (tab === 'register') { setSuccess('Account created! Redirecting...'); }
      setTimeout(() => router.push('/'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <Head>
        <title>{tab === 'login' ? 'Login' : 'Sign Up'} — CompareX</title>
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
        {/* Background orbs */}
        <div style={{ position: 'fixed', top: '20%', left: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', bottom: '10%', right: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚡</div>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CompareX</span>
          </Link>

          {/* Card */}
          <div style={{ background: 'rgba(22,22,31,0.9)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 24, padding: 36, backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 28 }}>
              {['login', 'register'].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', background: tab === t ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent', color: tab === t ? 'white' : '#9ca3af', boxShadow: tab === t ? '0 4px 12px rgba(99,102,241,0.3)' : 'none' }}>
                  {t === 'login' ? 'Login' : 'Sign Up'}
                </button>
              ))}
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', marginBottom: 6 }}>
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 28 }}>
              {tab === 'login' ? 'Compare prices and track your watchlist' : 'Join CompareX to track prices and get alerts'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>Name</label>
                  <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your name" className="form-input" />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>Email</label>
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" required className="form-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>Password</label>
                <input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="••••••••" required className="form-input" />
              </div>

              {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', fontSize: '0.8rem' }}>❌ {error}</div>}
              {success && <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, color: '#22c55e', fontSize: '0.8rem' }}>✅ {success}</div>}

              <button type="submit" id="auth-submit-btn" disabled={loading} style={{ padding: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 20px rgba(99,102,241,0.4)', opacity: loading ? 0.7 : 1, transition: 'all 0.2s', marginTop: 6 }}>
                {loading ? 'Please wait...' : tab === 'login' ? '→ Login to CompareX' : '→ Create Account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.8rem', color: '#6b7280' }}>
              {tab === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                {tab === 'login' ? 'Sign up' : 'Login'}
              </button>
            </p>
          </div>

          <Link href="/" style={{ display: 'block', textAlign: 'center', marginTop: 20, color: '#6b7280', textDecoration: 'none', fontSize: '0.8rem' }}>← Back to home</Link>
        </div>
      </div>
    </>
  );
}