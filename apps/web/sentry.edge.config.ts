import * as Sentry from '@sentry/nextjs';

// Edge runtime Sentry initialization (middleware, edge API routes).
// Imported via src/instrumentation.ts when NEXT_RUNTIME === 'edge'.
// Note: Edge runtime has no Node.js APIs — keep this minimal.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Low sample rate — middleware runs on every request
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.5,

  enabled: process.env.NODE_ENV !== 'development',
});
