// Single source of truth for "too slow". Every entry is keyed on the `name`
// tag that lib/http.js attaches to each request, so one slow endpoint cannot
// hide inside an aggregate with a fast one.
//
// ---------------------------------------------------------------------------
// THESE NUMBERS ARE PROVISIONAL AND HAVE NOT BEEN MEASURED.
// ---------------------------------------------------------------------------
// They are placeholders shaped by what each endpoint does (indexed point read
// vs. geo pipeline vs. multi-document transaction vs. aggregation), not by any
// observed run. Do not treat a pass as evidence of health, or a fail as
// evidence of regression, until they have been re-baselined:
//
//   1. pnpm k6:capacity:baseline       (runs suites/gate.js against staging 3x)
//   2. node tests/k6/tools/baseline.js results/baseline-*.json
//   3. paste the emitted table below and record the date
//
// The tool sets each gate at measured p95 x 1.3. The 1.3 is headroom for
// run-to-run variance on shared infrastructure; tighter than that and the gate
// flaps, looser and it stops catching anything.
//
// Last baselined: NEVER — see above.

/** Per-endpoint latency gates for the CI regression suite. */
const ENDPOINT_GATES = {
  // Cold-start burst: indexed single-document reads.
  auth_me: 250,
  notifications_unread: 250,
  favorites_ids: 250,

  // Discovery: the cached path.
  offers_list: 400,
  offer_detail: 250,
  offers_nearby: 600,
  offers_urgent: 400,
  search: 800,

  // Checkout: multi-document transaction plus payment initiation.
  order_create: 1500,
  order_detail: 300,
  payment_webhook: 800,

  // Merchant: aggregation-heavy, deliberately loose.
  merchant_orders: 1200,
  merchant_stats: 2000,
  merchant_revenue: 2500,

  // Driver.
  driver_available: 700,
  driver_location: 200,

  // Discovery pipeline — geo-search journey.
  discovery: 500,
  urgent: 500,
  detail: 300,
  suggestions: 200,
};

function durationThresholds(gates, extra = {}) {
  return Object.fromEntries(
    Object.entries(gates).map(([name, p95]) => [
      `http_req_duration{name:${name}}`,
      [`p(95)<${p95}`, ...(extra[name] ?? [])],
    ]),
  );
}

/**
 * CI regression gate. Fails the build.
 *
 * `abortOnFail` on checkout only: when the revenue path is broken there is
 * nothing to learn from the remaining minutes of the run, and a fast red build
 * gets looked at. `delayAbortEval` keeps warm-up requests from tripping it —
 * without it the first few cold-cache responses abort every run.
 */
export const GATE = {
  ...durationThresholds(ENDPOINT_GATES, { order_create: ['p(99)<3000'] }),

  'http_req_duration{name:order_create}': [
    { threshold: 'p(95)<1500', abortOnFail: true, delayAbortEval: '30s' },
    'p(99)<3000',
  ],

  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
  checks: ['rate>0.99'],
  order_create_success: ['rate>0.99'],
  // Refresh is excluded from the endpoint gates on purpose: a refresh storm at
  // the token-expiry mark would otherwise smear whichever endpoint follows it.
  'http_req_duration{name:auth_refresh}': ['p(95)<1000'],
};

/**
 * Capacity / breakpoint. Deliberately almost empty.
 *
 * A breakpoint test exists to find the cliff, so it must not abort at the
 * cliff. The single guard stops a pointless ramp into a service that is already
 * gone; the capacity number is read from the output, never from pass/fail.
 */
export const CAPACITY = {
  http_req_failed: [{ threshold: 'rate<0.50', abortOnFail: true, delayAbortEval: '2m' }],
};

/** Soak. Watches for drift over hours rather than absolute speed. */
export const SOAK = {
  http_req_failed: ['rate<0.02'],
  checks: ['rate>0.98'],
  // A soak that only reports an aggregate p95 hides a slow leak, because the
  // healthy first hour dilutes the degraded second one.
  'http_req_duration{name:offers_list}': ['p(95)<800'],
  'http_req_duration{name:order_create}': ['p(95)<2500'],
};

/** Spike: survival and recovery, not latency. */
export const SPIKE = {
  http_req_failed: ['rate<0.20'],
  checks: ['rate>0.75'],
};

/**
 * Concurrency correctness. Latency is irrelevant here — every threshold is an
 * invariant, and any violation is a real bug rather than a slow machine.
 */
export const CONCURRENCY = {
  // Exactly one buyer may win the single-unit offer. Overselling is the
  // failure this suite exists to catch, and it is visible here as a second
  // acceptance — not as an error, since an oversold order returns 201 like any
  // other. The database side (reserved + sold <= total) is checked separately
  // by verify:loadtest-invariants.
  order_accepted: ['count==1'],

  // A 5xx means the guard errored rather than refusing, which would leave the
  // real outcome unknown.
  unexpected_server_errors: ['count==0'],
};

export { GEO_SEARCH_THRESHOLDS as GEO_SEARCH } from '../lib/contracts/geo-search.js';

export { ENDPOINT_GATES };
