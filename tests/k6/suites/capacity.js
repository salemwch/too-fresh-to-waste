// Breakpoint test. Manual / nightly, against staging only.
//
//   k6 run tests/k6/suites/capacity.js --env ENV=staging
//
// Ramps past the point of degradation on purpose and keeps going, so the shape
// of the cliff is visible rather than just its onset. Almost no thresholds:
// a breakpoint test that aborts at the breakpoint has not measured anything.
// Read the capacity number from results/capacity-summary.json, not from the
// exit code.
//
// Three settings multiply into the ceiling this test finds:
//   total Mongo sockets = MONGO_MAX_POOL_SIZE x WEB_CONCURRENCY x replicas
// If the run dies at a suspiciously round number, check that product first.

import { CAPACITY_PROFILE } from '../config/profiles.js';
import { CAPACITY } from '../config/thresholds.js';
import { makeExecs, setupPools } from '../lib/runner.js';
import { summaryHandler } from '../lib/summary.js';

export const options = {
  scenarios: CAPACITY_PROFILE,
  thresholds: CAPACITY,
  setupTimeout: '300s',
  // Discard response bodies once parsed: at 400 VUs the generator itself
  // becomes the bottleneck otherwise, and you measure k6, not the API.
  discardResponseBodies: false,
};

export function setup() {
  return setupPools({ consumers: 200, merchants: 20, drivers: 10 });
}

const execs = makeExecs();

export const consumerColdStart = execs.consumerColdStart;
export const consumerBrowse = execs.consumerBrowse;
export const merchantDashboard = execs.merchantDashboard;

export const handleSummary = summaryHandler('capacity');
