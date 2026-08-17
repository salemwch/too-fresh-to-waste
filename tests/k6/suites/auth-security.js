// tests/k6/suites/auth-security.js
//
// Auth throttle correctness. Runs at PRODUCTION throttle values (not 10000).
// This is the one suite that tests the limiter, not the application behind it.
//
//   k6 run tests/k6/suites/auth-security.js --env ENV=docker
//
// Five scenarios, staggered by startTime so they do not pollute each other's
// throttle windows:
//
//   1. brute_force_login       (  0s -  60s)  30 VUs hammer one identity
//   2. legitimate_under_attack ( 70s - 250s)  5 ramping VUs, different accounts
//   3. cross_replica_throttle  (130s - 190s)  30 VUs, a second identity
//   4. forgot_password_flood   (200s - 260s)  10 VUs against /auth/forgot-password
//   5. throttle_key_isolation  (270s - 330s)  2 VUs, two more distinct accounts
//
// Scenarios 2 and 3 overlap in time by design — the point of (2) is that a
// legitimate user must stay fast and successful *while* an attack (against a
// different identity) and the cross-replica probe are both in flight.

import { check } from 'k6';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

import { SEED, seedEmail } from '../config/environments.js';
import { THROTTLE_POLICIES, AUTH_SECURITY_THRESHOLDS } from '../lib/contracts/auth-security.js';
import { post } from '../lib/http.js';
import { summaryHandler } from '../lib/summary.js';

export const authLeaked = new Counter('auth_leaked');
export const non429Count = new Counter('non_429_count');
export const legitimateSuccessRate = new Rate('legitimate_success_rate');
export const forgotNon429 = new Counter('forgot_non_429_count');
export const crossReplicaNon429 = new Counter('cross_replica_non_429');

// k6 isolates VU state: module-scope variables (a plain `Set`, for instance)
// are copied into every VU at init and are never shared back out — each VU
// mutates its own private copy. A 30-VU, one-iteration-each scenario would
// therefore always observe a Set of size 0 or 1 from any single VU's point of
// view, and handleSummary() runs in yet another, fresh context, so reading
// that Set there always sees an empty one. The only state that genuinely
// aggregates across VUs is a real k6 metric (Counter/Gauge/Rate/Trend) — those
// are backed by k6's native metrics engine, not the JS VM.
// Refs: https://grafana.com/docs/k6/latest/using-k6/execution-context-variables/
//       https://github.com/loadimpact/k6/issues/532
//
// So cross-replica detection here is done with real metrics: a Trend of the
// numeric X-Process-Id values seen by every VU (Trend aggregates globally,
// giving a correct min/max across the whole run), plus a Gauge that reports
// the most recently observed worker pid for human-readable context.
export const workerPidsObserved = new Gauge('worker_pids_observed');
export const workerPidNumericTrend = new Trend('cross_replica_worker_pid_numeric', false);
export const workerPidHeaderPresent = new Counter('cross_replica_pid_header_present');

const BRUTE_VUS = 30;
const policy = THROTTLE_POLICIES.login;

export const options = {
  scenarios: {
    brute_force_login: {
      executor: 'per-vu-iterations',
      vus: BRUTE_VUS,
      iterations: 1,
      exec: 'bruteForceLogin',
      startTime: '0s',
      maxDuration: '60s',
      tags: { scenario: 'brute_force_login' },
    },
    legitimate_under_attack: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '2m', target: 5 },
        { duration: '30s', target: 0 },
      ],
      exec: 'legitimateLogin',
      startTime: '70s',
      tags: { scenario: 'legitimate_under_attack' },
    },
    cross_replica_throttle: {
      executor: 'per-vu-iterations',
      vus: 30,
      iterations: 1,
      exec: 'crossReplicaThrottle',
      startTime: '130s',
      maxDuration: '60s',
      tags: { scenario: 'cross_replica_throttle' },
    },
    forgot_password_flood: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      exec: 'forgotPasswordFlood',
      startTime: '200s',
      maxDuration: '60s',
      tags: { scenario: 'forgot_password_flood' },
    },
    throttle_key_isolation: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 1,
      exec: 'throttleKeyIsolation',
      startTime: '270s',
      maxDuration: '60s',
      tags: { scenario: 'throttle_key_isolation' },
    },
  },
  thresholds: AUTH_SECURITY_THRESHOLDS,
  setupTimeout: '60s',
};

export function setup() {
  const legitimatePool = [];
  for (let i = 10; i < 15; i++) {
    legitimatePool.push({
      email: seedEmail(SEED.consumerEmailPattern, i),
      password: SEED.password,
    });
  }
  return { legitimatePool };
}

function safeParseBody(res) {
  if (!res.body) {
    return {};
  }
  try {
    return JSON.parse(res.body);
  } catch {
    return {};
  }
}

/**
 * Scenario 1 — brute-force a single identity.
 *
 * 30 VUs each send one login attempt for the same account with a wrong
 * password. The throttler should allow at most `policy.limit` non-429
 * responses. Any successful auth (200 with tokens) after the limit is
 * `auth_leaked` — the hard security invariant.
 */
export function bruteForceLogin() {
  const targetEmail = seedEmail(SEED.consumerEmailPattern, 0);
  const res = post(
    '/auth/login',
    { email: targetEmail, password: 'WrongPassword!999' },
    'auth_login',
  );

  if (res.status !== 429) {
    non429Count.add(1);
  }

  const body = safeParseBody(res);
  const hasTokens = body.data && body.data.tokens && body.data.tokens.accessToken;
  if (hasTokens && res.status === 200) {
    authLeaked.add(1);
  }

  check(res, {
    'brute force: no server error': r => r.status < 500,
  });
}

/**
 * Scenario 3 — legitimate users logging in while an attack is in progress.
 *
 * Different accounts from the brute-forced one. These should succeed at
 * >= 99% and under 500ms p95, proving the throttler does not degrade
 * innocent traffic.
 */
export function legitimateLogin(state) {
  const cred = state.legitimatePool[(__VU - 1) % state.legitimatePool.length];
  const res = post(
    '/auth/login',
    { email: cred.email, password: cred.password },
    'legitimate_login',
  );

  const isSuccess = res.status === 200 || res.status === 201;
  legitimateSuccessRate.add(isSuccess ? 1 : 0);

  check(res, {
    'legitimate: login succeeded': () => isSuccess,
    'legitimate: no server error': r => r.status < 500,
  });
}

/**
 * Scenario 2 — cross-replica throttle verification.
 *
 * 30 VUs hit login for the same (second) identity. The X-Process-Id response
 * header, if the backend sends one, is collected into a Trend as a numeric
 * value. Trend aggregates correctly across every VU (unlike a plain JS
 * variable — see the comment above the metric declarations), so its min/max
 * spread after the run tells us whether more than one worker replied: if
 * min === max, every sampled request landed on the same process and the
 * sub-test is INCONCLUSIVE (Implementation Rule 1) — a single-worker run
 * cannot prove distributed throttle correctness, whether that is because
 * this environment only has one replica or because the header is absent.
 */
export function crossReplicaThrottle() {
  const targetEmail = seedEmail(SEED.consumerEmailPattern, 1);
  const res = post(
    '/auth/login',
    { email: targetEmail, password: 'WrongPassword!999' },
    'cross_replica_login',
  );

  const pid = res.headers['X-Process-Id'] || res.headers['x-process-id'];
  if (pid) {
    workerPidHeaderPresent.add(1);
    const numericPid = Number(pid);
    if (!Number.isNaN(numericPid)) {
      workerPidNumericTrend.add(numericPid);
      workerPidsObserved.add(numericPid);
    }
  }

  if (res.status !== 429) {
    crossReplicaNon429.add(1);
  }

  check(res, {
    'cross-replica: no server error': r => r.status < 500,
  });
}

/**
 * Scenario 4 — flood /auth/forgot-password for one account.
 *
 * Separate, tighter policy (5/5min) from login. Verifies the forgot-password
 * limiter is wired up independently rather than sharing the login bucket.
 */
export function forgotPasswordFlood() {
  const targetEmail = seedEmail(SEED.consumerEmailPattern, 0);
  const res = post(
    '/auth/forgot-password',
    { email: targetEmail },
    'forgot_password',
  );

  if (res.status !== 429) {
    forgotNon429.add(1);
  }

  check(res, {
    'forgot password: no server error': r => r.status < 500,
  });
}

/**
 * Scenario 5 — throttle-key isolation.
 *
 * Two different accounts from the same IP. Both should succeed even
 * though the brute-force scenario already exhausted the limit for
 * account 0. Throttle is keyed on (identity + IP), not IP alone.
 *
 * If both succeed → key is per-identity (correct).
 * If the second is throttled → key might be IP-only (investigate).
 */
export function throttleKeyIsolation() {
  const accountIndex = __VU + 50;
  const email = seedEmail(SEED.consumerEmailPattern, accountIndex);
  const res = post(
    '/auth/login',
    { email, password: SEED.password },
    'isolation_login',
  );

  const isSuccess = res.status === 200 || res.status === 201;
  check(res, {
    'isolation: different account succeeds': () => isSuccess,
    'isolation: no server error': r => r.status < 500,
  });
}

export function handleSummary(data) {
  const counter = name =>
    data.metrics[name] && data.metrics[name].values ? data.metrics[name].values.count : 0;

  const leaked = counter('auth_leaked');
  const non429 = counter('non_429_count');
  const forgotNon = counter('forgot_non_429_count');
  const crossReplicaNon429Val = counter('cross_replica_non_429');
  const headerPresent = counter('cross_replica_pid_header_present');

  const pidTrend = data.metrics['cross_replica_worker_pid_numeric'];
  const pidSamples = pidTrend && pidTrend.values ? pidTrend.values.count : 0;
  const pidMin = pidTrend && pidTrend.values ? pidTrend.values.min : null;
  const pidMax = pidTrend && pidTrend.values ? pidTrend.values.max : null;
  const distinctWorkersConfirmed =
    pidSamples > 0 && pidMin !== null && pidMax !== null && pidMin !== pidMax;

  const pidGauge = data.metrics['worker_pids_observed'];
  const lastObservedPid = pidGauge && pidGauge.values ? pidGauge.values.value : null;

  // Implementation Rule 1: a single distinct worker pid (or no header at
  // all) cannot prove distributed correctness. Report INCONCLUSIVE, never
  // PASS, in that case — this is a tri-state, not the boolean the other
  // invariants use.
  const crossReplicaStatus =
    pidSamples === 0 || !distinctWorkersConfirmed
      ? 'INCONCLUSIVE'
      : crossReplicaNon429Val <= policy.limit
        ? 'PASS'
        : 'FAIL';

  const invariants = [
    {
      name: `auth_leaked == 0 (no successful auth past throttle limit)`,
      status: leaked === 0 ? 'PASS' : 'FAIL',
      passed: leaked === 0,
      detail: `leaked=${leaked}`,
    },
    {
      name: `login non-429 responses <= ${policy.limit} (${policy.label})`,
      status: non429 <= policy.limit ? 'PASS' : 'FAIL',
      passed: non429 <= policy.limit,
      detail: `non_429=${non429}, limit=${policy.limit}`,
    },
    {
      name: `forgot-password non-429 <= ${THROTTLE_POLICIES.forgotPassword.limit} (${THROTTLE_POLICIES.forgotPassword.label})`,
      status: forgotNon <= THROTTLE_POLICIES.forgotPassword.limit ? 'PASS' : 'FAIL',
      passed: forgotNon <= THROTTLE_POLICIES.forgotPassword.limit,
      detail: `non_429=${forgotNon}, limit=${THROTTLE_POLICIES.forgotPassword.limit}`,
    },
    {
      name: `cross-replica non-429 <= ${policy.limit} (${policy.label})`,
      status: crossReplicaStatus,
      passed: crossReplicaStatus !== 'FAIL',
      detail:
        `non_429=${crossReplicaNon429Val}, limit=${policy.limit}, ` +
        `pid_header_present=${headerPresent}/${BRUTE_VUS}, pid_samples=${pidSamples}, ` +
        `distinct_workers_confirmed=${distinctWorkersConfirmed}, last_pid=${lastObservedPid}` +
        (crossReplicaStatus === 'INCONCLUSIVE'
          ? ' — single worker (or no X-Process-Id header) observed; cannot prove distributed correctness'
          : ''),
    },
  ];

  const failed = invariants.filter(i => i.status === 'FAIL');
  const inconclusive = invariants.filter(i => i.status === 'INCONCLUSIVE');
  const lines = invariants
    .map(i => `  ${i.status}  ${i.name}\n        ${i.detail}`)
    .join('\n');

  const report =
    `\nAuth security invariants\n${lines}\n` +
    (failed.length === 0
      ? `\nAll enforceable auth security invariants held` +
        (inconclusive.length > 0 ? ` (${inconclusive.length} INCONCLUSIVE — see above).\n` : '.\n')
      : `\n${failed.length} INVARIANT VIOLATED.\n`);

  const base = summaryHandler('auth-security')(data);
  return {
    ...base,
    stdout: `${base.stdout}${report}`,
    'results/auth-security-invariants.json': JSON.stringify(
      { passed: failed.length === 0, invariants },
      null,
      2,
    ),
  };
}
