const { withSentryConfig } = require('@sentry/nextjs');
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Extract origin from API URL for CSP connect-src.
// In proxy mode NEXT_PUBLIC_API_URL is relative ("/api/v1"), so we
// fall back to NEXT_PUBLIC_WS_URL (always the real backend origin).
function getBackendUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  try {
    return new URL(apiUrl).origin;
  } catch {
    // Relative API URL (proxy mode) — use WS URL as the backend origin
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    try {
      return new URL(wsUrl).origin;
    } catch {
      return 'http://localhost:3000';
    }
  }
}

function getApiOrigin() {
  return getBackendUrl();
}

function getApiWsOrigin() {
  const origin = getBackendUrl();
  try {
    const url = new URL(origin);
    const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${url.host}`;
  } catch {
    return 'ws://localhost:3000';
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React strict mode for better practices
  reactStrictMode: true,

  /*
   * React Compiler (stable, v1.0.0).
   *
   * Auto-memoises components and hooks at build time, so a value only
   * recomputes when its inputs actually change. This app has 149 client
   * components and hand-written memoisation in just 26 files - the other ~123
   * re-render whenever their parent does.
   *
   * Safe to enable here specifically because the ESLint work in 6c3fd90b
   * already fixed all 33 react-hooks violations. The compiler silently skips
   * any component it cannot prove safe, so those fixes are what turn this from
   * near-no-op into real coverage.
   *
   * Babel transform rather than experimental.turbopackRustReactCompiler: the
   * Rust port is faster but experimental, and this decides what ships to
   * production. Re-evaluate when it becomes the default.
   */
  reactCompiler: true,

  /*
   * No `eslint` key here.
   *
   * Next 16 removed it along with `next lint`, and warns "Invalid next.config.js
   * options detected" if it is left in place. It held
   * `ignoreDuringBuilds: true`, which is now the only behaviour available:
   * `next build` no longer runs ESLint at all. Linting is a separate gate
   * (`pnpm lint`, and the CI job), so nothing is lost by dropping it.
   */

  // Performance
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [25, 50, 75, 85, 100],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 1 day — optimized images are immutable until the source changes
    remotePatterns: [
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
  // cross-origin warnings (Next.js 15+ requirement).
  // Set DEV_ALLOWED_ORIGINS to a comma-separated list of IPs/hostnames.
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  }),

  /*
   * Permanent redirects for routes that have been removed.
   *
   * `/business-signup` was a marketing page whose only action was a mailto:
   * link. It was in the sitemap, so it is indexed and will have inbound links;
   * deleting it without a redirect turns every one of those into a 404 and
   * throws away whatever authority the URL had earned. 308 tells Google to
   * transfer that to the real signup instead.
   *
   * Both forms are listed because next-intl serves the locale-prefixed URL
   * while a bare path can still arrive from an old link or a typed address.
   */
  async redirects() {
    return [
      {
        source: '/business-signup',
        destination: '/merchant-signup',
        permanent: true,
      },
      {
        source: '/:locale(en|fr|ar)/business-signup',
        destination: '/:locale/merchant-signup',
        permanent: true,
      },
    ];
  },

  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        // Android App Links verification — must be plain JSON, no restrictive headers
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
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
          ...(isProd
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
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
            // strict-origin-when-cross-origin: sends full URL for same-origin,
            // origin-only for cross-origin HTTPS→HTTPS, nothing for HTTPS→HTTP.
            // Eliminates the "origin-when-cross-origin ignored for cross-site
            // request" browser console noise produced by the previous value.
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // Disable credential/identity APIs (prevents Chrome Android FedCM
            // prompt triggered by Google Analytics loading Google Identity scripts).
            // geolocation=(self): allow only same-origin GPS requests.
            // identity-credentials-get=(): block FedCM sign-in prompts.
            // publickey-credentials-get=(): block WebAuthn/passkey prompts.
            value:
              'camera=(), microphone=(), geolocation=(self), identity-credentials-get=(), publickey-credentials-get=()',
          },
          {
            // Isolates the top-level browsing context from cross-origin documents
            // (e.g. OAuth pop-ups). Required for SharedArrayBuffer on some browsers.
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Content-Security-Policy',
            // unsafe-inline: required by Next.js for build-time injected <script> tags
            // unsafe-eval: required by Next.js dev overlay + Google Analytics dependencies
            // TODO: migrate to nonce-based CSP when Next.js supports it natively
            value: [
              "default-src 'self'",
              // maps.googleapis.com: the Maps JavaScript API loader used by the
              // admin dispatch map. It then pulls its own modules from
              // maps.gstatic.com, so both hosts are required - allowing only
              // the first leaves the map a blank grey box with a console error
              // rather than a visible failure.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://va.vercel-scripts.com https://maps.googleapis.com https://maps.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Map tiles are served as images from several Google hosts;
              // marker and control sprites come from gstatic.
              "img-src 'self' data: blob: http://localhost:* https://storage.googleapis.com https://firebasestorage.googleapis.com https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleusercontent.com",
              "font-src 'self' https://fonts.gstatic.com",
              // The Maps JS API fetches tile metadata and place data over XHR.
              "connect-src 'self' https://api.brevo.com https://www.google-analytics.com https://region1.google-analytics.com https://vitals.vercel-insights.com https://maps.googleapis.com " +
                getApiOrigin() +
                ' ' +
                getApiWsOrigin(),
              // Allow blob: workers (e.g. Sentry's worker-based envelope transport)
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },

  // API proxy rewrite: browser calls /api/* (same-origin, no CORS headers needed).
  // Vercel edge forwards to the actual backend; cookies flow through unchanged.
  //
  // Uses NEXT_PUBLIC_WS_URL (always the real backend origin) as the destination,
  // so the rewrite works even when NEXT_PUBLIC_API_URL is a relative path (/api/v1).
  //
  // ACTIVATE proxy mode on Vercel:
  //   NEXT_PUBLIC_API_URL  = /api/v1            ← Axios uses relative paths
  //   NEXT_PUBLIC_WS_URL   = https://api.toofreshtowaste.com  ← rewrite destination + Socket.IO
  //
  // Direct mode (current — no Vercel rewrite needed):
  //   NEXT_PUBLIC_API_URL  = https://api.toofreshtowaste.com/api/v1
  //   NEXT_PUBLIC_WS_URL   = https://api.toofreshtowaste.com
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!backendUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },

  // Transpile workspace packages
  transpilePackages: ['@foodwaste/ui', '@foodwaste/shared'],

  // Generate source maps for all production bundles so Sentry can upload them.
  // hideSourceMaps:true in withSentryConfig strips the public //# sourceMappingURL
  // references, so end users cannot download the maps from the deployed bundle.
  productionBrowserSourceMaps: true,

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    // Generate source maps for server-side bundles so Sentry can upload them.
    // Fixes "could not determine a source map reference" upload warnings.
    serverSourceMaps: true,
  },
};

module.exports = withSentryConfig(withNextIntl(nextConfig), {
  // Sentry CLI org + project — set via Vercel env vars or CI secrets
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print Sentry output when running in CI (not on every local build)
  silent: !process.env.CI,

  // Upload a wider set of source maps for cleaner stack traces
  widenClientFileUpload: true,

  // Proxy Sentry events through /monitoring route so ad-blockers can't drop them.
  // Browser → /monitoring (same-origin) → Sentry ingest (server-side).
  // No CSP changes needed.
  tunnelRoute: '/monitoring',

  // Keep source maps off the client bundle (security: hides your source)
  hideSourceMaps: true,

  // Tree-shake Sentry logger statements from production bundle.
  // disableLogger was deprecated in favour of the nested option below.
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
