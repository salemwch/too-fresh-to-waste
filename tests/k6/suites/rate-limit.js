// Asserts the rate limiter still works, at production values.
//
//   k6 run tests/k6/suites/rate-limit.js --env ENV=docker \
//        --env THROTTLE_LIMIT=100 --env THROTTLE_TTL=60000
//
// Every other suite runs against an environment where THROTTLE_LIMIT has been
// raised, because a load generator arrives from one IP and would otherwise
// spend the whole run collecting 429s. Raising a security control for testing
// is only defensible if something still checks it, so this suite exists to be
// that something: it runs against the *real* configured limit and asserts the
// limiter fires.
//
// Point it at a backend started with production throttle values. It is
// deliberately not part of the gate profile — it would poison the token bucket
// for everything running beside it.

import { check } from 'k6';
import { Counter } from 'k6/metrics';

import { get } from '../lib/http.js';
import { summaryHandler } from '../lib/summary.js';

const LIMIT = Number.parseInt(__ENV.THROTTLE_LIMIT || '100', 10);
// Enough headroom past the limit that a boundary-off-by-one cannot mask a
// limiter that is not running at all.
const REQUESTS = Math.ceil(LIMIT * 1.5);

export const throttled = new Counter('throttled_requests');
export const allowed = new Counter('allowed_requests');

export const options = {
  scenarios: {
    burst: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: REQUESTS,
      maxDuration: '50s', // inside one TTL window, or the bucket refills mid-run
    },
  },
  thresholds: {
    // If nothing is throttled the limiter is off, which is the failure this
    // suite exists to catch.
    throttled_requests: ['count>0'],
  },
};

export default function () {
  // An unauthenticated public endpoint: this measures the global per-IP
  // limiter rather than any per-user or per-route guard.
  const res = get('/config/app-version', 'rate_limit_probe');

  if (res.status === 429) {
    throttled.add(1);
  } else if (res.status === 200) {
    allowed.add(1);
  }

  check(res, {
    'rate limit: responded 200 or 429': r => r.status === 200 || r.status === 429,
  });
}

export function handleSummary(data) {
  const count = name =>
    data.metrics[name] && data.metrics[name].values ? data.metrics[name].values.count : 0;

  const throttledCount = count('throttled_requests');
  const allowedCount = count('allowed_requests');

  const report =
    `\nRate limiter\n` +
    `  configured limit : ${LIMIT} per window\n` +
    `  requests sent    : ${REQUESTS}\n` +
    `  allowed          : ${allowedCount}\n` +
    `  throttled (429)  : ${throttledCount}\n` +
    (throttledCount > 0
      ? '  limiter is active\n'
      : '  LIMITER DID NOT FIRE — brute-force protection is not in effect\n');

  const base = summaryHandler('rate-limit')(data);
  return { ...base, stdout: `${base.stdout}${report}` };
}
