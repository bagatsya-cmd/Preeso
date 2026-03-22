/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            { source: '/api/:path*', destination: 'http://localhost:5000/api/:path*' }
        ];
    },
    images: {
        domains: ['images.unsplash.com', 'www.amazon.in', 'rukminim2.flixcart.com', 'm.media-amazon.com'],
        unoptimized: true
    }
};

module.exports = nextConfig;
