import { useState, useEffect } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';

export default function WishlistPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('preeso_token') || localStorage.getItem('comparex_token');
    if (!token) { setLoading(false); return; }
    axios.get('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { setProducts(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('preeso_token') || localStorage.getItem('comparex_token'))
    : null;

  return (
    <>
      <Head>
        <title>My Wishlist | Preeso</title>
        <meta name="description" content="Your saved products on Preeso — track prices and get the best deals." />
        <link rel="canonical" href="https://www.preeso.co.in/wishlists" />
        <meta property="og:title" content="My Wishlist | Preeso" />
        <meta property="og:description" content="Your saved products on Preeso — track prices and get the best deals." />
        <meta property="og:url" content="https://www.preeso.co.in/wishlists" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.preeso.co.in/preeso-icon.png" />
        <link rel="icon" href="/favicon.png" />
      </Head>
      <Navbar />
      <main style={{ paddingTop: 100, paddingBottom: 80, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Poppins, sans-serif', letterSpacing: '-0.03em' }}>❤️ My Wishlist</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.9rem' }}>Your saved products for price tracking on Preeso</p>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, color: '#9ca3af' }}>
              <div className="spinner" />
              <span>Loading wishlist...</span>
            </div>
          )}

          {!loading && !token && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: 16 }}>🔐</span>
              <h2 style={{ color: '#9ca3af', marginBottom: 20 }}>Login to see your wishlist</h2>
              <Link href="/login" className="btn btn-primary">Login / Register</Link>
            </div>
          )}

          {!loading && token && products.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: 16 }}>🤍</span>
              <h2 style={{ color: '#9ca3af', marginBottom: 8 }}>Your wishlist is empty</h2>
              <p style={{ color: '#6b7280', marginBottom: 24, fontSize: '0.875rem' }}>Search for products and click the heart icon to save them here</p>
              <Link href="/" className="btn btn-primary">Browse Products</Link>
            </div>
          )}

          {!loading && products.length > 0 && (
            <>
              <p style={{ color: '#9ca3af', marginBottom: 24, fontSize: '0.875rem' }}>{products.length} saved product{products.length !== 1 ? 's' : ''}</p>
              <div className="products-grid">
                {products.map(p => <ProductCard key={p._id} product={p} inWishlistProp={true} />)}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}