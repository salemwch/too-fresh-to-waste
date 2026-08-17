// Load shapes, kept separate from the journeys so the same journey can be run
// as a gate, a breakpoint or a soak without editing it.
//
// Closed vs open model matters more than the numbers. `ramping-vus` is closed:
// a VU waits for its response before issuing the next request, which is what a
// person tapping an app does — as the server slows, offered load falls with it.
// `constant-arrival-rate` is open: it issues N iterations per unit time no
// matter how slow the server is, which is what a polling client does. Using a
// closed model everywhere is the most common load-testing mistake, because it
// silently throttles the load exactly when the system starts to struggle, and
// the cliff never appears.

/** ~4 min. Runs on every PR against docker compose. */
export const GATE_PROFILE = {
  consumer_cold_start: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '2m', target: 10 },
      { duration: '20s', target: 0 },
    ],
    exec: 'consumerColdStart',
    tags: { journey: 'cold_start' },
  },
  consumer_browse: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },
      { duration: '2m', target: 20 },
      { duration: '20s', target: 0 },
    ],
    exec: 'consumerBrowse',
    tags: { journey: 'browse' },
  },
  // ~5% of traffic: the real conversion shape, and every iteration permanently
  // consumes seeded stock.
  consumer_checkout: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 2 },
      { duration: '2m', target: 2 },
      { duration: '20s', target: 0 },
    ],
    exec: 'consumerCheckout',
    tags: { journey: 'checkout' },
  },
  merchant_dashboard: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 3 },
      { duration: '2m', target: 3 },
      { duration: '20s', target: 0 },
    ],
    exec: 'merchantDashboard',
    tags: { journey: 'merchant' },
  },
  driver_poll: {
    executor: 'constant-arrival-rate',
    rate: 12,
    timeUnit: '1m',
    duration: '3m10s',
    preAllocatedVUs: 5,
    maxVUs: 10,
    exec: 'driverPoll',
    tags: { journey: 'driver' },
  },
  // Discovery pipeline — the hottest read path in the product. Warm-cache
  // browse only; low-cache-reuse and pagination-depth run via the standalone
  // geo-search profiling suite, not the PR gate.
  consumer_search: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '2m', target: 10 },
      { duration: '20s', target: 0 },
    ],
    exec: 'consumerSearch',
    tags: { journey: 'search' },
  },
  // Mobile session lifecycle — normal lifecycle only (login, rehydrate,
  // refresh, logout). Expired-token, reuse-detection and concurrent-refresh
  // scenarios are correctness checks, not gate load, and live in the
  // standalone suites/mobile-session.js instead.
  consumer_session: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5 },
      { duration: '2m', target: 5 },
      { duration: '20s', target: 0 },
    ],
    exec: 'consumerSession',
    tags: { journey: 'session' },
  },
  // Order-creation burst, the k6-visible half of the notification-storm
  // check. Kept small at gate scale — the full storm (order burst + read
  // flood + mark-all-read at 30/20/10 VUs) runs via the standalone
  // suites/notification-storm.js, not the PR gate.
  notification_burst: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5 },
      { duration: '2m', target: 5 },
      { duration: '20s', target: 0 },
    ],
    exec: 'notificationBurst',
    tags: { journey: 'notification' },
  },
  // WebSocket compatibility check — connect + authenticate over the real
  // Engine.IO/Socket.IO framing. Full WS load (room join, heartbeat,
  // disconnect/reconnect, unauthenticated timeout) runs via the standalone
  // suites/websocket-load.js, not the PR gate.
  websocket_connect: {
    executor: 'per-vu-iterations',
    vus: 10,
    iterations: 1,
    exec: 'websocketConnect',
    startTime: '0s',
    maxDuration: '60s',
    tags: { journey: 'websocket' },
  },
};

/**
 * Breakpoint. Ramps until something gives, then keeps going so the shape of
 * the degradation is visible rather than just its onset.
 */
export const CAPACITY_PROFILE = {
  consumer_browse: {
    executor: 'ramping-vus',
    startVUs: 5,
    stages: [
      { duration: '2m', target: 25 },
      { duration: '2m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 400 },
      { duration: '1m', target: 0 },
    ],
    exec: 'consumerBrowse',
    tags: { journey: 'browse' },
  },
  consumer_cold_start: {
    executor: 'ramping-vus',
    startVUs: 2,
    stages: [
      { duration: '4m', target: 40 },
      { duration: '4m', target: 120 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
    ],
    exec: 'consumerColdStart',
    tags: { journey: 'cold_start' },
  },
  merchant_dashboard: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '5m', target: 10 },
      { duration: '5m', target: 25 },
      { duration: '1m', target: 0 },
    ],
    exec: 'merchantDashboard',
    tags: { journey: 'merchant' },
  },
};

/** 2 hours steady. Finds leaks and pool exhaustion, which no short run can. */
export const SOAK_PROFILE = {
  consumer_browse: {
    executor: 'constant-vus',
    vus: 20,
    duration: '2h',
    exec: 'consumerBrowse',
    tags: { journey: 'browse' },
  },
  consumer_checkout: {
    executor: 'constant-arrival-rate',
    rate: 30,
    timeUnit: '1m',
    duration: '2h',
    preAllocatedVUs: 10,
    maxVUs: 30,
    exec: 'consumerCheckout',
    tags: { journey: 'checkout' },
  },
  driver_poll: {
    executor: 'constant-arrival-rate',
    rate: 20,
    timeUnit: '1m',
    duration: '2h',
    preAllocatedVUs: 5,
    maxVUs: 15,
    exec: 'driverPoll',
    tags: { journey: 'driver' },
  },
};

/** Burst and recovery. The recovery leg is the part worth watching. */
export const SPIKE_PROFILE = {
  spike: {
    executor: 'ramping-vus',
    startVUs: 5,
    stages: [
      { duration: '1m', target: 5 }, // baseline
      { duration: '10s', target: 150 }, // burst
      { duration: '2m', target: 150 }, // sustained
      { duration: '10s', target: 5 }, // drop
      { duration: '3m', target: 5 }, // does it actually recover?
      { duration: '30s', target: 0 },
    ],
    exec: 'consumerColdStart',
    tags: { journey: 'cold_start' },
  },
};
