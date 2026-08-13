// tests/k6/suites/subscription-race.js
//
// Subscription payment concurrency. Requires PAYMENT_PROVIDER=stub.
//
//   k6 run tests/k6/suites/subscription-race.js --env ENV=docker
//   pnpm --filter @foodwaste/backend verify:loadtest-invariants

import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

import { SEED, seedEmail } from '../config/environments.js';
import { SUBSCRIPTION_RACE_THRESHOLDS } from '../lib/contracts/subscription-race.js';
import { login, authParams } from '../lib/auth.js';
import { post, get } from '../lib/http.js';
import { docId, parse } from '../lib/envelope.js';
import { summaryHandler } from '../lib/summary.js';

export const initiateSuccess = new Counter('initiate_success');
export const webhookSuccess = new Counter('webhook_success');

const ESTABLISHMENTS_COUNT = 10;

// Reserved seed index for the duplicate-webhook scenario, kept out of the
// `merchants` pool used by the other two scenarios so an earlier scenario
// can never mutate this establishment's subscription state first.
const DUPLICATE_WEBHOOK_MERCHANT_INDEX = ESTABLISHMENTS_COUNT;

export const options = {
  scenarios: {
    double_initiate: {
      executor: 'per-vu-iterations',
      vus: ESTABLISHMENTS_COUNT * 2,
      iterations: 1,
      exec: 'doubleInitiate',
      startTime: '0s',
      maxDuration: '120s',
      tags: { scenario: 'double_initiate' },
    },
    wrong_tier_proof: {
      executor: 'per-vu-iterations',
      vus: ESTABLISHMENTS_COUNT,
      iterations: 1,
      exec: 'wrongTierProof',
      startTime: '130s',
      maxDuration: '120s',
      tags: { scenario: 'wrong_tier_proof' },
    },
    duplicate_subscription_webhook: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      exec: 'duplicateSubscriptionWebhook',
      startTime: '260s',
      maxDuration: '60s',
      tags: { scenario: 'duplicate_webhook' },
    },
  },
  thresholds: SUBSCRIPTION_RACE_THRESHOLDS,
  setupTimeout: '180s',
};

/**
 * `GET /subscriptions/status` (`SubscriptionStatusResponseDto`) does not
 * return `establishmentId` — only status/tier/cycle/expiry fields. The only
 * endpoint that resolves "this merchant's establishment id" is
 * `GET /establishments/my-establishment`, which returns
 * `{ data: [...establishments] }` for the merchant's own establishments.
 * Seeded merchants own exactly one establishment, so `data[0]` is it.
 */
function resolveEstablishmentId(session) {
  const res = get('/establishments/my-establishment', 'my_establishment', authParams(session));
  const body = parse(res);
  if (body && Array.isArray(body.data) && body.data.length > 0) {
    return docId(body.data[0]);
  }
  return null;
}

export function setup() {
  // Login as merchants and resolve their establishment IDs.
  const merchants = [];
  for (let i = 0; i < ESTABLISHMENTS_COUNT; i++) {
    const s = login(seedEmail(SEED.merchantEmailPattern, i), SEED.password);
    if (s) {
      const estId = resolveEstablishmentId(s);
      merchants.push({ ...s, establishmentId: estId, index: i });
    }
  }

  if (merchants.length === 0) {
    throw new Error('No merchant accounts available. Run seed:loadtest first.');
  }

  // The duplicate-webhook scenario needs ONE payment reference shared by all
  // 10 VUs — that is the entire point of the test (does settlement happen
  // once or N times when the same webhook replays concurrently?). Minting it
  // here, on a single VU, is Rule 7/8: no concurrent VU may write the shared
  // ledger key the other VUs are about to race on.
  let duplicateWebhookRef = null;
  const duplicateWebhookMerchant = login(
    seedEmail(SEED.merchantEmailPattern, DUPLICATE_WEBHOOK_MERCHANT_INDEX),
    SEED.password,
  );
  if (duplicateWebhookMerchant) {
    const estId = resolveEstablishmentId(duplicateWebhookMerchant);
    if (estId) {
      const initRes = post(
        '/subscriptions/initiate',
        { tier: 'standard', cycle: 'monthly', establishmentId: estId },
        'subscription_initiate',
        authParams(duplicateWebhookMerchant),
      );
      const initBody = parse(initRes);
      duplicateWebhookRef = initBody && initBody.data ? initBody.data.paymentRef : null;
    }
  }

  if (!duplicateWebhookRef) {
    throw new Error(
      `Could not mint a payment reference for the duplicate-webhook scenario. ` +
        `Check that k6-merchant-${DUPLICATE_WEBHOOK_MERCHANT_INDEX}@loadtest.local exists ` +
        '(SEED_MERCHANTS must be > ' + DUPLICATE_WEBHOOK_MERCHANT_INDEX + ').',
    );
  }

  return { merchants, duplicateWebhookRef };
}

/**
 * Scenario 1 — double initiate (different tiers).
 *
 * For each establishment, VU1 initiates standard/monthly and VU2 initiates
 * pro/yearly simultaneously. `initiatePayment` writes `pendingTier` /
 * `pendingCycle` then `lastPaymentRef` in two separate updates, so this also
 * exercises whichever of the two calls lands last.
 */
export function doubleInitiate(state) {
  const estIdx = Math.floor((__VU - 1) / 2);
  const isSecondVU = (__VU - 1) % 2 === 1;
  const merchant = state.merchants[estIdx % state.merchants.length];
  if (!merchant || !merchant.establishmentId) return;

  const tier = isSecondVU ? 'pro' : 'standard';
  const cycle = isSecondVU ? 'yearly' : 'monthly';

  const res = post(
    '/subscriptions/initiate',
    {
      tier,
      cycle,
      establishmentId: merchant.establishmentId,
    },
    'subscription_initiate',
    authParams(merchant),
  );

  const isSuccess = res.status === 200 || res.status === 201;

  if (isSuccess) {
    initiateSuccess.add(1);
  }

  check(res, {
    'double initiate: no server error': r => r.status < 500,
  });
}

/**
 * Scenario 2 — wrong-tier proof.
 *
 * Payment A (standard/monthly) is initiated, then payment B (pro/yearly)
 * follows for the same establishment. The webhook is then fired for
 * payment A's `paymentRef`.
 *
 * `initiatePayment` writes two fields per call, in sequence:
 *   1. $set pendingTier/pendingCycle
 *   2. $set lastPaymentRef (to that call's own ref)
 *
 * so after payment B runs, `lastPaymentRef` on the establishment is B's ref,
 * not A's. `handleWebhook` looks the establishment up by
 * `{ lastPaymentRef: payload.payment_ref }` — so firing A's ref finds NO
 * establishment at all (a stale, orphaned reference), rather than settling
 * with the "wrong" tier as a naive reading of the race might suggest.
 *
 * The assertion below (`settledTier === 'standard'`) fails either way a race
 * exists: if the webhook silently no-ops (lastPaymentRef race) the tier
 * stays unset, and if some other code path did honour a stale ref with B's
 * already-overwritten pendingTier, the tier would read 'pro'. Either failure
 * is the proof this scenario exists to produce — a customer whose payment A
 * webhook fires is never charged (Konnect confirmed it) but never gets
 * activated either.
 */
export function wrongTierProof(state) {
  const merchant = state.merchants[(__VU - 1) % state.merchants.length];
  if (!merchant || !merchant.establishmentId) return;

  // Initiate standard/monthly as payment A
  const initA = post(
    '/subscriptions/initiate',
    { tier: 'standard', cycle: 'monthly', establishmentId: merchant.establishmentId },
    'subscription_initiate',
    authParams(merchant),
  );
  const bodyA = parse(initA);
  const refA = bodyA && bodyA.data ? bodyA.data.paymentRef : null;

  sleep(0.5);

  // Initiate pro/yearly as payment B (overwrites pendingTier/pendingCycle
  // and, once its own initiate completes, lastPaymentRef too).
  post(
    '/subscriptions/initiate',
    { tier: 'pro', cycle: 'yearly', establishmentId: merchant.establishmentId },
    'subscription_initiate',
    authParams(merchant),
  );

  sleep(0.5);

  // Fire webhook for payment A
  if (refA) {
    const webhookRes = post(
      '/subscriptions/webhook/konnect',
      { payment_ref: refA },
      'subscription_webhook',
    );

    check(webhookRes, {
      'wrong-tier proof: webhook accepted': r => r.status === 200 || r.status === 201,
      'wrong-tier proof: no server error': r => r.status < 500,
    });

    // Verify settled state
    sleep(1);
    const statusRes = get('/subscriptions/status', 'subscription_status', authParams(merchant));
    const status = parse(statusRes);
    if (status && status.data) {
      const settledTier = status.data.subscriptionTier;
      // If payment A settled correctly, settledTier is 'standard'. If the
      // lastPaymentRef race described above exists, it is undefined
      // (webhook orphaned) rather than 'pro' — see the function comment.
      check(null, {
        'wrong-tier proof: settled tier matches payment A (standard)': () =>
          settledTier === 'standard',
      });
    }
  }
}

/**
 * Scenario 3 — duplicate webhook.
 *
 * The single paymentRef minted once in setup() (Rule 7/8: no concurrent VU
 * writes it) is replayed by all 10 VUs, concurrently, against the SAME
 * establishment. `handleWebhook` has no paymentRef-keyed idempotency guard —
 * its only duplicate defence is a business heuristic ("already paid with
 * more than 7 days remaining? skip"), which is a TOCTOU race if two webhook
 * calls both read `subscriptionStatus` before either commits. Settlement
 * effects (the expiry extension) should happen exactly once; if the guard
 * loses the race, `subscriptionExpiresAt` gets pushed out on every duplicate
 * call instead of on only the first.
 */
export function duplicateSubscriptionWebhook(state) {
  if (!state.duplicateWebhookRef) return;

  const res = post(
    '/subscriptions/webhook/konnect',
    { payment_ref: state.duplicateWebhookRef },
    'subscription_webhook',
  );

  if (res.status === 200 || res.status === 201) {
    webhookSuccess.add(1);
  }

  check(res, {
    'duplicate webhook: no server error': r => r.status < 500,
  });
}

export const handleSummary = summaryHandler('subscription-race');
