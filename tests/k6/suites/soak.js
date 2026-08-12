// 2-hour soak. Nightly, staging only.
//
//   k6 run tests/k6/suites/soak.js --env ENV=staging
//
// Looks for what a 4-minute run structurally cannot see: memory growth,
// connection-pool exhaustion, unbounded embedded arrays, and token refresh at
// the ~15-minute expiry mark (which is exercised here as a side effect, since
// lib/auth.js refreshes on 401 exactly as the real clients do).
//
// Checkout runs on an open model so a slowdown does not quietly reduce the
// order rate — a soak that throttles itself as the system degrades will report
// a flat, healthy-looking line right up until it falls over.

import { SOAK_PROFILE } from '../config/profiles.js';
import { SOAK } from '../config/thresholds.js';
import { makeExecs, setupPools } from '../lib/runner.js';
import { summaryHandler } from '../lib/summary.js';

export const options = {
  scenarios: SOAK_PROFILE,
  thresholds: SOAK,
  setupTimeout: '300s',
};

export function setup() {
  return setupPools({ consumers: 60, merchants: 10, drivers: 10 });
}

const execs = makeExecs();

export const consumerBrowse = execs.consumerBrowse;
export const consumerCheckout = execs.consumerCheckout;
export const driverPoll = execs.driverPoll;

export const handleSummary = summaryHandler('soak');
