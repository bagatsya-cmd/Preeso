import '../styles/globals.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
console.log('[API BASE]', API_BASE_URL);

export default function App({ Component, pageProps }) {
    return <Component {...pageProps} />;
}
