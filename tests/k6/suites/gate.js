// CI regression gate. ~4 minutes, runs on every PR against docker compose.
//
//   k6 run tests/k6/suites/gate.js --env ENV=docker
//
// Thresholds fail the build. Requires the seed to have run and the compose
// stack to be up with PAYMENT_PROVIDER=stub and the throttler raised.

import { GATE_PROFILE } from '../config/profiles.js';
import { GATE } from '../config/thresholds.js';
import { makeExecs, setupPools } from '../lib/runner.js';
import { summaryHandler } from '../lib/summary.js';

export const options = {
  scenarios: GATE_PROFILE,
  thresholds: GATE,
  // N sequential logins against bcrypt comfortably exceed the 60s default.
  setupTimeout: '180s',
  // Fail fast on an unreachable target rather than burning the whole budget.
  noConnectionReuse: false,
};

export function setup() {
  // Peak concurrent consumer VUs across scenarios: cold_start(10) +
  // browse(20) + checkout(2) + search(10) + session(5) + notification(5) +
  // websocket_connect(10) = 62. Sized above that so no two VUs share a
  // session at the same moment (see lib/runner.js `pick`).
  return setupPools({ consumers: 65, merchants: 5, drivers: 5 });
}

const execs = makeExecs();

export const consumerColdStart = execs.consumerColdStart;
export const consumerBrowse = execs.consumerBrowse;
export const consumerCheckout = execs.consumerCheckout;
export const consumerSearch = execs.consumerSearch;
export const consumerSession = execs.consumerSession;
export const merchantDashboard = execs.merchantDashboard;
export const driverPoll = execs.driverPoll;
export const notificationBurst = execs.notificationBurst;
export const websocketConnect = execs.websocketConnect;

export const handleSummary = summaryHandler('gate');
