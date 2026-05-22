/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            { source: '/api/:path*', destination: 'http://127.0.0.1:5000/api/:path*' }
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
