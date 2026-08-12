// Concurrency correctness. Runs in CI (docker) on every PR touching orders,
// payments, loyalty or donations, and nightly against staging.
//
//   k6 run tests/k6/suites/concurrency.js --env ENV=docker
//   pnpm --filter @foodwaste/backend verify:loadtest-invariants   # DB-level half
//
// These are correctness tests, not performance tests. Latency is irrelevant;
// every threshold is an invariant, and a violation is a real bug. If one fails,
// fix the application — never relax the assertion.
//
// -------------------------------------------------------------------------
// Burst alignment
// -------------------------------------------------------------------------
// k6 has no barrier primitive. `per-vu-iterations` with iterations:1 starts
// every VU together, giving roughly a 20-50 ms spread. That is wider than a
// CPU-level race but comfortably inside the window these bugs live in: each one
// spans at least one Mongo round trip, and the webhook additionally spans an
// outbound provider call. Scenarios are separated by startTime so they cannot
// interfere with one another.
//
// -------------------------------------------------------------------------
// Where the assertions live
// -------------------------------------------------------------------------
// k6 can only see HTTP responses, but most of these invariants are database
// facts. So the checks are split:
//   * here          - the HTTP-visible invariant (how many 201s, how many 400s)
//   * verify:loadtest-invariants - the database invariant (how many Sale rows)
// Both must pass. The HTTP side alone would miss double-crediting entirely.

import { check } from 'k6';
import { Counter } from 'k6/metrics';

import { SEED } from '../config/environments.js';
import { CONCURRENCY } from '../config/thresholds.js';
import { authParams, login } from '../lib/auth.js';
import { parse } from '../lib/envelope.js';
import { patch, post } from '../lib/http.js';
import { summaryHandler } from '../lib/summary.js';

// Written by `pnpm --filter @foodwaste/backend seed:loadtest` (or --scarce-only).
const fixtures = JSON.parse(open('../fixtures/concurrency.json'));

const LAST_BAG_VUS = 50;
const WEBHOOK_VUS = 20;

// PATCH /orders/:id/confirm-pickup carries its own @Throttle({limit: 5,
// ttl: 60000}) through PickupThrottlerGuard — an explicit per-route limit that
// the environment's THROTTLE_LIMIT override does not touch. Asking for 20 VUs
// would mostly measure that guard. Five simultaneous requests is well inside
// the window these races live in; the bugs this covers needed only two.
const PICKUP_VUS = 5;

const COMPLETION_ORDERS = fixtures.completionOrders || [];

export const orderAccepted = new Counter('order_accepted');
export const orderRejectedCleanly = new Counter('order_rejected_cleanly');
export const webhookAcknowledged = new Counter('webhook_acknowledged');
export const pickupAccepted = new Counter('pickup_accepted');
export const completionAccepted = new Counter('completion_accepted');

export const options = {
  scenarios: {
    // 1. Fifty buyers, one bag.
    last_bag: {
      executor: 'per-vu-iterations',
      vus: LAST_BAG_VUS,
      iterations: 1,
      exec: 'lastBag',
      startTime: '0s',
      maxDuration: '60s',
      tags: { scenario: 'last_bag' },
    },

    // 2. The same provider callback, delivered twenty times at once.
    duplicate_webhook: {
      executor: 'per-vu-iterations',
      vus: WEBHOOK_VUS,
      iterations: 1,
      exec: 'duplicateWebhook',
      startTime: '70s',
      maxDuration: '60s',
      tags: { scenario: 'duplicate_webhook' },
    },

    // 3. The same pickup confirmation, delivered five times at once. Targets
    // the loyalty-points idempotency guard: one order must credit once.
    duplicate_pickup: {
      executor: 'per-vu-iterations',
      vus: PICKUP_VUS,
      iterations: 1,
      exec: 'duplicatePickup',
      startTime: '140s',
      maxDuration: '60s',
      tags: { scenario: 'duplicate_pickup' },
    },

    // 4+5. N *distinct* orders completed simultaneously, against a donation
    // pool parked just short of its target.
    //
    // This has to be a separate scenario from the one above. Duplicate-
    // confirming a single order cannot exercise rotation at all: once the
    // idempotency guard holds, exactly one confirmation succeeds, one donation
    // is written, and nothing races. The rotation bug needs concurrent
    // contributions from different orders, which is what this produces — and
    // it drives concurrent referral bag-count updates for the same buyer at
    // the same time.
    concurrent_completions: {
      executor: 'per-vu-iterations',
      vus: Math.max(COMPLETION_ORDERS.length, 1),
      iterations: 1,
      exec: 'concurrentCompletion',
      startTime: '210s',
      maxDuration: '60s',
      tags: { scenario: 'concurrent_completions' },
    },
  },
  thresholds: CONCURRENCY,
  setupTimeout: '120s',
};

export function setup() {
  const session = login(fixtures.buyerEmail || `k6-consumer-0@loadtest.local`, SEED.password);
  if (!session) {
    throw new Error('Could not authenticate the concurrency buyer. Did the seed run?');
  }
  return { session, fixtures };
}

/**
 * Scenario 1 — last bag.
 *
 * HTTP invariant: exactly one 201, the rest 400 INSUFFICIENT_STOCK, no 5xx.
 * DB invariant (verifier): reservedQuantity + soldQuantity <= totalQuantity,
 * and exactly one order references the scarce offer.
 *
 * Expected to pass: order creation guards the reservation with a conditional
 * $expr inside a transaction. This is regression cover for that guard, not a
 * hunt — it is the test that fails the day someone "simplifies" it.
 */
export function lastBag(state) {
  const offer = state.fixtures.scarceOffer;

  const res = post(
    '/orders',
    {
      items: [{ offerId: offer.id, quantity: 1 }],
      establishmentId: offer.establishmentId,
      pickupTimeSlot: { startTime: offer.slotStart, endTime: offer.slotEnd },
      pickupDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'cash_on_pickup',
    },
    'order_create',
    authParams(state.session),
  );

  const accepted = res.status === 200 || res.status === 201;

  // Any 4xx is a clean rejection. Do NOT insist on the INSUFFICIENT_STOCK code:
  // the losers observed here get 400 "One or more offers are invalid or
  // unavailable" instead, because the winning order flips the offer to SOLD_OUT
  // and findActiveOffersForOrder then rejects it *before* the reservation guard
  // is reached. Both paths are correct refusals; demanding one specific message
  // tests the wording rather than the invariant, and reported a false failure
  // when the system had behaved perfectly.
  //
  // What actually matters — and is asserted in handleSummary and by the DB
  // verifier — is that exactly one order was accepted and nothing 5xx'd.
  const rejectedCleanly = !accepted && res.status >= 400 && res.status < 500;

  if (accepted) {
    orderAccepted.add(1);
  } else if (rejectedCleanly) {
    orderRejectedCleanly.add(1);
  }

  check(res, {
    'last bag: resolved as sale or clean refusal': () => accepted || rejectedCleanly,
    'last bag: no server error': r => r.status < 500,
  });
}

/**
 * Scenario 2 — duplicate webhook.
 *
 * HTTP invariant: every delivery is acknowledged (the provider must never be
 * told to retry a callback that was in fact processed).
 * DB invariant (verifier): PaymentAttempt settles to `paid` exactly once,
 * exactly one Sale record, one merchant credit, one donation contribution.
 *
 * Expected to pass: handleOrderWebhook claims the attempt with an atomic
 * `pending -> processing` compare-and-set before opening its transaction, so
 * only one delivery can proceed. The read-then-check above that claim is a
 * fast path, not the guard.
 */
export function duplicateWebhook(state) {
  const res = post(
    '/payments/webhook/konnect',
    { payment_ref: state.fixtures.paymentRef },
    'payment_webhook',
  );

  if (res.status === 200 || res.status === 201) {
    webhookAcknowledged.add(1);
  }

  check(res, {
    'duplicate webhook: acknowledged': r => r.status === 200 || r.status === 201,
    'duplicate webhook: no server error': r => r.status < 500,
  });
}

/**
 * Scenario 3 — duplicate pickup confirmation of one order.
 *
 * HTTP invariant: at most one confirmation succeeds; the rest fail cleanly
 * (4xx, including 429 from the per-route pickup throttle), never 5xx.
 * DB invariants (verifier): loyalty pointsHistory contains this orderId exactly
 * once, and totalBagsSaved is incremented once rather than once per request.
 *
 * Expected to pass: addPoints filters on `pointsHistory.orderId $ne` inside a
 * single findOneAndUpdate.
 */
export function duplicatePickup(state) {
  const order = state.fixtures.pickupOrder;

  const res = patch(
    `/orders/${order.id}/confirm-pickup`,
    { pickupCode: order.pickupCode },
    'order_confirm_pickup',
    authParams(state.session),
  );

  if (res.status === 200 || res.status === 201) {
    pickupAccepted.add(1);
  }

  check(res, {
    'duplicate pickup: no server error': r => r.status < 500,
  });
}

/**
 * Scenarios 4 and 5 — concurrent completion of distinct orders.
 *
 * Each VU confirms its own order, so every one of them *should* succeed. What
 * races is everything hanging off completion: the donation contribution (pool
 * parked one contribution short of target by the seed), the referral bag count
 * for a single shared buyer, and N separate point awards.
 *
 * HTTP invariant: no 5xx. Individual 4xx is tolerated — the pickup throttle is
 * per-route and these arrive together — but the DB invariants below must hold
 * for however many did land.
 *
 * DB invariants (verifier):
 *   - exactly one ACTIVE donation pool  (BUG-3: this is the one that regressed)
 *   - no funded pool above its target, no goal completed twice in a season
 *   - no friend duplicated in an account's referrals  (BUG-1)
 *   - friendReferralsCompleted matches the completed entries  (BUG-2)
 *   - one donation per order
 */
export function concurrentCompletion(state) {
  const order = state.fixtures.completionOrders[(__VU - 1) % state.fixtures.completionOrders.length];
  if (!order) {
    return;
  }

  const res = patch(
    `/orders/${order.id}/confirm-pickup`,
    { pickupCode: order.pickupCode },
    'order_confirm_pickup',
    authParams(state.session),
  );

  if (res.status === 200 || res.status === 201) {
    completionAccepted.add(1);
  }

  check(res, {
    'concurrent completion: no server error': r => r.status < 500,
  });
}

export function handleSummary(data) {
  const counter = name =>
    data.metrics[name] && data.metrics[name].values ? data.metrics[name].values.count : 0;

  const accepted = counter('order_accepted');
  const rejected = counter('order_rejected_cleanly');
  const acknowledged = counter('webhook_acknowledged');
  const pickups = counter('pickup_accepted');
  const completions = counter('completion_accepted');

  const invariants = [
    {
      name: 'exactly one order accepted for the last bag',
      passed: accepted === 1,
      detail: `accepted=${accepted} (expected 1)`,
    },
    {
      // Every buyer must reach a definite outcome. A shortfall here means some
      // request 5xx'd or never resolved, which is the thing that would hide an
      // oversell.
      name: 'every other buyer refused cleanly (4xx, no server error)',
      passed: accepted + rejected === LAST_BAG_VUS,
      detail: `accepted=${accepted} + refused=${rejected} = ${accepted + rejected} (expected ${LAST_BAG_VUS})`,
    },
    {
      name: 'every duplicate webhook acknowledged',
      passed: acknowledged === WEBHOOK_VUS,
      detail: `acknowledged=${acknowledged} (expected ${WEBHOOK_VUS})`,
    },
    {
      name: 'at most one pickup confirmation succeeded',
      passed: pickups <= 1,
      detail: `succeeded=${pickups} (expected <= 1)`,
    },
    {
      // Distinct orders, so each should land. Zero means the fixtures were
      // stale or already consumed, which would make scenarios 4-5 vacuous —
      // worth failing on rather than reporting a green run that tested nothing.
      name: 'concurrent completions of distinct orders landed',
      passed: completions > 0,
      detail: `succeeded=${completions} of ${COMPLETION_ORDERS.length} (expected > 0)`,
    },
  ];

  const failed = invariants.filter(i => !i.passed);
  const lines = invariants
    .map(i => `  ${i.passed ? 'PASS' : 'FAIL'}  ${i.name}\n        ${i.detail}`)
    .join('\n');

  const report =
    `\nHTTP-level concurrency invariants\n${lines}\n` +
    (failed.length === 0
      ? '\nAll HTTP invariants held. Now run tools/verify-invariants.js for the database side.\n'
      : `\n${failed.length} INVARIANT VIOLATED — this is a correctness bug, not a slow machine.\n`);

  const base = summaryHandler('concurrency')(data);

  return {
    ...base,
    stdout: `${base.stdout}${report}`,
    'results/concurrency-invariants.json': JSON.stringify(
      { passed: failed.length === 0, invariants },
      null,
      2,
    ),
  };
}
