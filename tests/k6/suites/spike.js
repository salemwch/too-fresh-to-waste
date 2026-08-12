// Spike and recovery. Staging only.
//
//   k6 run tests/k6/suites/spike.js --env ENV=staging
//
// Models a push notification or a viral post: 5 -> 150 VUs in ten seconds.
// The interesting leg is the one after the burst, not the burst itself. A
// system that survives the spike but never returns to baseline latency has a
// queue it is not draining, and that only shows up in the recovery window.

import { SPIKE_PROFILE } from '../config/profiles.js';
import { SPIKE } from '../config/thresholds.js';
import { makeExecs, setupPools } from '../lib/runner.js';
import { summaryHandler } from '../lib/summary.js';

export const options = {
  scenarios: SPIKE_PROFILE,
  thresholds: SPIKE,
  setupTimeout: '300s',
};

export function setup() {
  return setupPools({ consumers: 150, merchants: 5, drivers: 5 });
}

const execs = makeExecs();

export const consumerColdStart = execs.consumerColdStart;

export const handleSummary = summaryHandler('spike');
