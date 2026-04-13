import * as Sentry from '@sentry/nextjs';

// Server-side (Node.js runtime) Sentry initialization.
// Imported via src/instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Disabled in development and test
  enabled: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',

  // These are expected HTTP errors — not bugs
  ignoreErrors: [
    'ValidationError',
    'BadRequestException',
    'UnauthorizedException',
    'ForbiddenException',
    'NotFoundException',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ],
});
