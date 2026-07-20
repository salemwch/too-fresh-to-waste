// k6 Environment Configuration
// Usage: k6 run --env ENV=staging tests/k6/scenarios/load.test.js

const environments = {
  local: {
    baseUrl: 'http://localhost:3000/api/v1',
    wsUrl: 'ws://localhost:3000',
  },
  staging: {
    baseUrl: 'https://api-staging.toofreshtowaste.com/api/v1',
    wsUrl: 'wss://api-staging.toofreshtowaste.com',
  },
  production: {
    baseUrl: 'https://api.toofreshtowaste.com/api/v1',
    wsUrl: 'wss://api.toofreshtowaste.com',
  },
};

const env = __ENV.ENV || 'local';
const config = environments[env];

if (!config) {
  throw new Error(`Unknown environment: ${env}. Use: local, staging, production`);
}

export const BASE_URL = config.baseUrl;
export const WS_URL = config.wsUrl;

// Test user credentials — set via --env or use defaults for local dev
export const TEST_CONSUMER_EMAIL = __ENV.CONSUMER_EMAIL || 'test-consumer@example.com';
export const TEST_CONSUMER_PASSWORD = __ENV.CONSUMER_PASSWORD || 'TestPass123!';
export const TEST_MERCHANT_EMAIL = __ENV.MERCHANT_EMAIL || 'test-merchant@example.com';
export const TEST_MERCHANT_PASSWORD = __ENV.MERCHANT_PASSWORD || 'TestPass123!';
export const TEST_ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@toofreshtowaste.com';
export const TEST_ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'AdminPass123!';

// Thresholds applied globally
export const THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.05'],
  checks: ['rate>0.95'],
};
