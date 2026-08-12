import { SEED } from '../config/environments.js';
import { consumerBrowse } from '../journeys/consumer-browse.js';
import { consumerCheckout } from '../journeys/consumer-checkout.js';
import { consumerColdStart } from '../journeys/consumer-cold-start.js';
import { warmCacheBrowse } from '../journeys/consumer-search.js';
import { driverPoll } from '../journeys/driver-poll.js';
import { merchantDashboard } from '../journeys/merchant-dashboard.js';
import { mintTokenPool } from './auth.js';

// Shared wiring so every suite mints its pools the same way and the exec names
// in config/profiles.js resolve identically wherever they are used.

/**
 * Mints one pool per actor. Runs once, on a single VU, before any scenario.
 *
 * Sizes come from the seed so a suite cannot ask for more sessions than exist —
 * requesting user 250 of 200 seeded ones fails every login and produces an
 * empty pool, which is a confusing way to discover the seed did not run.
 */
export function setupPools({ consumers, merchants, drivers } = {}) {
  return {
    consumers: mintTokenPool(Math.min(consumers ?? 50, SEED.consumerCount)),
    merchants: mintTokenPool(
      Math.min(merchants ?? 5, SEED.merchantCount),
      SEED.merchantEmailPattern,
    ),
    drivers: mintTokenPool(Math.min(drivers ?? 5, SEED.driverCount), SEED.driverEmailPattern),
  };
}

/**
 * Picks this VU's session. `__VU` is 1-based and unique across scenarios, so
 * modulo spreads VUs over the pool without two of them holding the same session
 * at the same instant while the pool is at least as large as peak VUs.
 */
function pick(pool) {
  return pool[(__VU - 1) % pool.length];
}

export function makeExecs() {
  return {
    consumerColdStart: data => consumerColdStart(pick(data.consumers)),
    consumerBrowse: data => consumerBrowse(pick(data.consumers)),
    consumerCheckout: data => consumerCheckout(pick(data.consumers)),
    consumerSearch: data => warmCacheBrowse(pick(data.consumers)),
    merchantDashboard: data => merchantDashboard(pick(data.merchants)),
    driverPoll: data => driverPoll(pick(data.drivers)),
  };
}
