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
          // Amazon
          'www.amazon.in', 'm.media-amazon.com', 'images-amazon.com',
          'ssl-images-amazon.com', 'images.amazon.com',
          // Flipkart
          'rukminim2.flixcart.com', 'rukminim1.flixcart.com', 'rukminim3.flixcart.com',
          'ext.fkcdn.com', 'img1.flixcart.com',
          // Myntra
          'assets.myntassets.com', 'constant.myntassets.com', 'www.myntassets.com',
          // AJIO (uses Fynd CDN)
          'cdn.fynd.com', 'img.ajio.com', 'adn.ajio.com',
          'sg2-cf.fynd.com', 'fynd-media.fynd.com',
          // Nykaa
          'nykaa.com', 'nykaafashion.com',
          'images.nykaa.com', 'adn.nykaa.com', 'cdn.nykaa.com',
          'nykaafashion.com',
          // Reliance Digital
          'www.reliancedigital.in', 'images.reliancedigital.in',
          // Generic / Misc
          'images.unsplash.com', 'akamai.net',
          'cloudinary.com', 'res.cloudinary.com',
        ],
        unoptimized: true
    }
};

module.exports = nextConfig;
