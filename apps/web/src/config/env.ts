const isProd = process.env.NODE_ENV === 'production';

/**
 * Read an env var. In production the variable MUST exist (no localhost fallbacks).
 * In development a fallback is accepted so the app boots without a full .env.
 */
const getEnvVar = (key: string, devFallback?: string): string => {
  const value = process.env[key];
  if (value) return value;

  if (isProd) {
    throw new Error(`Missing required environment variable in production: ${key}`);
  }

  if (devFallback) return devFallback;
  throw new Error(`Missing environment variable: ${key}`);
};

export const env = {
  siteUrl: getEnvVar('NEXT_PUBLIC_SITE_URL', 'http://localhost:3001'),
  apiUrl: getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:3000/api/v1'),
  websocketUrl: getEnvVar('NEXT_PUBLIC_WEBSOCKET_URL', 'ws://localhost:3000'),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),

  // Feature flags
  enableAnalytics: process.env['NEXT_PUBLIC_ENABLE_ANALYTICS'] === 'true',
  enablePWA: process.env['NEXT_PUBLIC_ENABLE_PWA'] === 'true',

  // Optional
  gaMeasurementId: process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'],
  sentryDsn: process.env['NEXT_PUBLIC_SENTRY_DSN'],
  googleMapsKey: process.env['NEXT_PUBLIC_GOOGLE_MAPS_KEY'],
} as const;
