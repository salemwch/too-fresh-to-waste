import * as Sentry from '@sentry/nextjs';

// Client-side Sentry initialization.
// Next.js 15 picks this file up automatically for browser initialization.
// Replaces the deprecated sentry.client.config.ts convention (not supported by Turbopack).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 10% trace sampling in production to keep quota low
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Always record replays on error; sample 10% of healthy sessions
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text + block media to avoid PII in replays
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Disabled in development — use browser console instead
  enabled: process.env.NODE_ENV !== 'development',

  // Suppress known noise that doesn't represent real bugs
  ignoreErrors: [
    'AbortError',
    'NetworkError when attempting to fetch resource',
    'Failed to fetch',
    'Load failed',
    'ChunkLoadError',
    /Loading chunk \d+ failed/,
    /Loading CSS chunk \d+ failed/,
    // Safari private browsing storage errors
    'SecurityError: The operation is insecure',
  ],
});
