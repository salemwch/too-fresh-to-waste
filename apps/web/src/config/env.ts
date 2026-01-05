const getEnvVar = (key: string, fallback?: string): string => {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
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

// Validate required variables on startup
if (typeof window === 'undefined') {
  console.log('✅ Environment variables validated');
}
