import type { NextConfig } from "next";

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_URL?.replace('https://', '').replace('http://', '') || '';

const nextConfig: NextConfig = {
  serverExternalPackages: ["canvas", "sharp"],
  experimental: {
    workerThreads: false,
  },
  async rewrites() {
    if (!CLOUDFRONT_DOMAIN) return [];
    return [
      {
        source: '/cdn/:path*',
        destination: `https://${CLOUDFRONT_DOMAIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
