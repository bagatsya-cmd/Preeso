import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const STORE_PALETTE = {
  Amazon:           { line: '#ff9900', fill: 'rgba(255,153,0,0.08)' },
  Flipkart:         { line: '#2874f0', fill: 'rgba(40,116,240,0.08)' },
  Myntra:           { line: '#ff3f6c', fill: 'rgba(255,63,108,0.08)' },
  'Reliance Digital': { line: '#e11d48', fill: 'rgba(225,29,72,0.08)' },
  AJIO:             { line: '#333333', fill: 'rgba(51,51,51,0.08)' },
  Nykaa:            { line: '#e91e8c', fill: 'rgba(233,30,140,0.08)' },
};

export default function PriceHistoryChart({ history = [], stores = [] }) {
  // Build one dataset per store
  const storeNames = [...new Set(history.map(h => h.storeName))];

  // Get unique sorted dates
  const allDates = [...new Set(history.map(h => new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })))];

  const datasets = storeNames.map(storeName => {
    const palette = STORE_PALETTE[storeName] || { line: '#6366f1', fill: 'rgba(99,102,241,0.08)' };
    const storeHistory = history.filter(h => h.storeName === storeName);
    const priceMap = {};
    storeHistory.forEach(h => {
      const label = new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      priceMap[label] = h.price;
    });
    return {
      label: storeName,
      data: allDates.map(d => priceMap[d] || null),
      borderColor: palette.line,
      backgroundColor: palette.fill,
      fill: false,
      tension: 0.4,
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: palette.line,
      spanGaps: true,
    };
  });

  const data = { labels: allDates, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#9ca3af', font: { family: 'Inter, sans-serif', size: 12 },
          usePointStyle: true, pointStyleWidth: 10, padding: 20,
          boxHeight: 6
        }
      },
      tooltip: {
        backgroundColor: 'rgba(22,22,31,0.97)',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        titleColor: '#f1f1f5',
        bodyColor: '#9ca3af',
        padding: 14,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}` }
      }
    },
    scales: {
      x: {
        ticks: { color: '#6b7280', font: { size: 11 }, maxTicksLimit: 10 },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { color: 'rgba(255,255,255,0.08)' }
      },
      y: {
        ticks: { color: '#6b7280', font: { size: 11 }, callback: v => '₹' + Number(v).toLocaleString('en-IN') },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { color: 'rgba(255,255,255,0.08)' }
      }
    }
  };

  if (!history || history.length === 0) {
    return (
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: '2rem' }}>📊</span>
        <span>No price history available yet</span>
      </div>
    );
  }

  return (
    <div style={{ height: 280, position: 'relative' }}>
      <Line data={data} options={options} />
    </div>
  );
}