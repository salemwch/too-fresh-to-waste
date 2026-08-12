// Environment targets. Selected with `--env ENV=<name>`.
//
// `docker` is the CI gate target: compose brings up Mongo (single-node replica
// set), Redis and the backend with PAYMENT_PROVIDER=stub and the throttler
// raised, so runs are comparable between commits. `staging` is the only target
// where capacity numbers mean anything, because it is the only one on real
// infrastructure.

const environments = {
  local: {
    baseUrl: 'http://localhost:3000/api/v1',
    rootUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
  },
  docker: {
    baseUrl: 'http://localhost:3000/api/v1',
    rootUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
  },
  staging: {
    baseUrl: 'https://api-staging.toofreshtowaste.com/api/v1',
    rootUrl: 'https://api-staging.toofreshtowaste.com',
    wsUrl: 'wss://api-staging.toofreshtowaste.com',
  },
};

const env = __ENV.ENV || 'local';
const config = environments[env];

if (!config) {
  throw new Error(`Unknown environment: ${env}. Use one of: ${Object.keys(environments).join(', ')}`);
}

export const ENV_NAME = env;
export const BASE_URL = config.baseUrl;
// Health lives outside the versioned prefix. Building it by appending `/../`
// to BASE_URL produced a literal `/api/v1/../health` path that only worked on
// proxies that happened to normalise it.
export const ROOT_URL = config.rootUrl;
export const WS_URL = config.wsUrl;

// Seeded fixture credentials. The seed script writes N consumers of the form
// k6-consumer-<i>@loadtest.local, all sharing one password.
export const SEED = {
  consumerEmailPattern: __ENV.SEED_CONSUMER_PATTERN || 'k6-consumer-{i}@loadtest.local',
  merchantEmailPattern: __ENV.SEED_MERCHANT_PATTERN || 'k6-merchant-{i}@loadtest.local',
  driverEmailPattern: __ENV.SEED_DRIVER_PATTERN || 'k6-driver-{i}@loadtest.local',
  password: __ENV.SEED_PASSWORD || 'K6LoadTest!2026',
  consumerCount: Number.parseInt(__ENV.SEED_CONSUMERS || '200', 10),
  merchantCount: Number.parseInt(__ENV.SEED_MERCHANTS || '20', 10),
  driverCount: Number.parseInt(__ENV.SEED_DRIVERS || '10', 10),
};

export function seedEmail(pattern, index) {
  return pattern.replace('{i}', String(index));
}

// Tunis, for the geo-bound endpoints.
export const TUNIS = { latitude: 36.8065, longitude: 10.1815 };
