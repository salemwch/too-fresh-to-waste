'use strict';

/**
 * Pins every Jest run (unit, integration and web) to UTC, in the main process
 * that Jest's worker pool is forked from - a forked child inherits
 * `process.env` at fork time, which happens after this runs, so every worker
 * sees `TZ=UTC` too.
 *
 * `merchant-sales.period.ts` resolves every period in Africa/Tunis and the
 * trend chart's X axis is pinned the same way; both are tested against that
 * exact zone. Without a pin, those tests only prove the code is correct when
 * the host happens to already run in Africa/Tunis - true of local dev
 * machines here, false of CI, which defaults to UTC. A test that passes only
 * by matching the host's own zone catches nothing (task-17-lens4-report.md
 * #2). Pinning UTC here removes the host zone as a variable for every suite,
 * not only the ones this specific bug would have affected.
 */
module.exports = async function globalSetupPinUtc() {
  process.env.TZ = 'UTC';
};
