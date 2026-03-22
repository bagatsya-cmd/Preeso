import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navbar() {
    const [user, setUser] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('comparex_token');
        const userData = localStorage.getItem('comparex_user');
        if (token && userData) setUser(JSON.parse(userData));
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('comparex_token');
        localStorage.removeItem('comparex_user');
        setUser(null);
        router.push('/');
    };

    return (
        <nav style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            background: scrolled ? 'rgba(10,10,15,0.95)' : 'transparent',
            backdropFilter: scrolled ? 'blur(20px)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent',
            transition: 'all 0.3s ease',
            padding: '0 24px'
        }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70 }}>
                {/* Logo */}
                <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, boxShadow: '0 4px 15px rgba(99,102,241,0.4)'
                    }}>⚡</div>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CompareX</span>
                </Link>

                {/* Desktop Nav */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link href="/" style={{ color: router.pathname === '/' ? '#6366f1' : '#9ca3af', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 500, fontSize: '0.9rem', transition: 'all 0.2s' }}>Home</Link>
                    {user && <Link href="/wishlists" style={{ color: router.pathname === '/wishlists' ? '#6366f1' : '#9ca3af', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 500, fontSize: '0.9rem', transition: 'all 0.2s' }}>❤️ Wishlist</Link>}

                    {user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 8 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>
                                {user.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                            <Link href="/login" className="btn btn-ghost btn-sm">Login</Link>
                            <Link href="/login?tab=register" className="btn btn-primary btn-sm">Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
