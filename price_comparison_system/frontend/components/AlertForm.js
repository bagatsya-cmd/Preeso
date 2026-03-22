import { useState } from 'react';
import axios from 'axios';

export default function AlertForm({ productId, stores = [], currentLowest }) {
  const [targetPrice, setTargetPrice] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [status, setStatus] = useState(null); // 'success' | 'error' | null
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('comparex_token');
    if (!token) { setStatus({ type: 'error', msg: 'Please login to set price alerts' }); return; }
    if (!targetPrice || isNaN(targetPrice)) { setStatus({ type: 'error', msg: 'Please enter a valid price' }); return; }
    setLoading(true);
    try {
      await axios.post(`/api/products/${productId}/alert`, { targetPrice: Number(targetPrice), storeName: selectedStore }, { headers: { Authorization: `Bearer ${token}` } });
      setStatus({ type: 'success', msg: `Alert set! We'll notify you when price drops below ₹${Number(targetPrice).toLocaleString('en-IN')}` });
      setTargetPrice('');
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.message || 'Failed to set alert. Please try again.' });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  return (
    <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: '1.3rem' }}>🔔</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f1f5' }}>Price Drop Alert</h3>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Get notified when the price drops to your target</p>
        </div>
      </div>

      {currentLowest && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '8px 14px', marginBottom: 16, fontSize: '0.8rem', color: '#22c55e' }}>
          Current best price: <strong>₹{Number(currentLowest).toLocaleString('en-IN')}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stores.length > 0 && (
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: '12px 14px', background: 'var(--bg-secondary)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, color: '#d1d5db', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none' }}>
            <option value="">All Platforms (any)</option>
            {stores.map(s => <option key={s.storeName} value={s.storeName}>{s.storeName} — ₹{Number(s.price).toLocaleString('en-IN')}</option>)}
          </select>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.9rem' }}>₹</span>
            <input
              type="number"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              placeholder="Enter target price"
              min="1"
              required
              style={{ width: '100%', padding: '12px 14px 12px 28px', background: 'var(--bg-secondary)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, color: '#f1f1f5', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
            {loading ? 'Setting...' : 'Set Alert'}
          </button>
        </div>
      </form>

      {status && (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: status.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${status.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: status.type === 'success' ? '#22c55e' : '#ef4444', fontSize: '0.8rem' }}>
          {status.type === 'success' ? '✅ ' : '❌ '}{status.msg}
        </div>
      )}
    </div>
  );
}