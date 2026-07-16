import '../styles/globals.css';
import Script from 'next/script';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
console.log('[API BASE]', API_BASE_URL);

export default function App({ Component, pageProps }) {
    return (
        <>
            {/* Google Analytics */}
            <Script
                strategy="afterInteractive"
                src="https://www.googletagmanager.com/gtag/js?id=G-8P3XYNWGZR"
            />

            <Script
                id="google-analytics"
                strategy="afterInteractive"
            >
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());

                  gtag('config', 'G-8P3XYNWGZR');
                `}
            </Script>

            <Component {...pageProps} />
        </>
    );
}