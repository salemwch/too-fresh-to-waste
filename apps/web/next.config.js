const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React strict mode for better practices
  reactStrictMode: true,

  // Disable ESLint during build (run separately with pnpm lint)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Performance
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [25, 50, 75, 85, 100],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/toofreshtowaste.firebasestorage.app/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/toofreshtowaste**',
      },
      // Supabase storage (user-uploaded avatars)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Backend self-hosted uploads (dev + prod)
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_API_HOSTNAME ?? 'localhost',
        pathname: '/uploads/**',
      },
    ],
  },

  // Output mode (standalone requires admin on Windows for symlinks)
  // output: 'standalone', // Enable for Docker deployment

  // Disable x-powered-by header
  poweredByHeader: false,

  // Trailing slash preference
  trailingSlash: false,

  // Allow local network IPs to access the Next.js dev server without
  // cross-origin warnings (Next.js 15+ requirement)
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['192.168.1.4'],
  }),

  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // HSTS must only be sent over a real HTTPS connection in production.
          // Sending it in dev (over HTTP on an IP) causes the browser to cache
          // the domain as HTTPS-only, breaking future HTTP redirects.
          ...(isProd ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }] : []),
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // Disable credential/identity APIs (prevents Chrome Android FedCM
            // prompt triggered by Google Analytics loading Google Identity scripts).
            // geolocation=(self): allow only same-origin GPS requests.
            // identity-credentials-get=(): block FedCM sign-in prompts.
            // publickey-credentials-get=(): block WebAuthn/passkey prompts.
            value: 'camera=(), microphone=(), geolocation=(self), identity-credentials-get=(), publickey-credentials-get=()',
          },
        ],
      },
    ];
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Transpile workspace packages
  transpilePackages: ['@foodwaste/ui', '@foodwaste/shared'],

  // Experimental features
  experimental: {
    optimizePackageImports: ['@foodwaste/shared', '@foodwaste/ui'],
  },
};

module.exports = withNextIntl(nextConfig);
