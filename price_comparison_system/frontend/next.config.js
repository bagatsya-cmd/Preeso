/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        ENABLE_AMAZON: process.env.ENABLE_AMAZON || 'false',
    },
    async rewrites() {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        return [
            { source: '/api/:path*', destination: `${backendUrl}/api/:path*` }
        ];
    },
    images: {
        domains: [
          'images.unsplash.com',
          'www.amazon.in', 'm.media-amazon.com',
          'rukminim2.flixcart.com', 'rukminim1.flixcart.com',
          'assets.myntassets.com', 'constant.myntassets.com',
          'cdn.fynd.com',                         // AJIO CDN
          'img.ajio.com',                          // AJIO
          'adn.ajio.com',
          'images.unsplash.com',
          'akamai.net',
          'nykaa.com', 'nykaafashion.com',
          'images.nykaa.com', 'adn.nykaa.com',
          'ext.fkcdn.com',
        ],
        unoptimized: true
    }
};

module.exports = nextConfig;
