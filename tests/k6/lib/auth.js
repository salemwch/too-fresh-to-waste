import http from 'k6/http';
import { Counter } from 'k6/metrics';

import { BASE_URL, SEED, seedEmail } from '../config/environments.js';

export const loginFailures = new Counter('login_failures');
export const tokenRefreshes = new Counter('token_refreshes');

/**
 * Mints the shared token pool. Runs once, in setup(), on a single VU.
 *
 * Logging in inside a journey means measuring bcrypt, which is slow by design —
 * the previous suite did exactly that and every latency number it produced was
 * really a password-hashing benchmark.
 *
 * Pool size should match peak VUs so no two VUs share a session at the same
 * moment. Sharing serialises on per-user rate limits and pollutes the per-user
 * reads (favourites, notifications) with a cache hit rate that does not exist
 * in production.
 *
 * Note for the caller: setup() has a 60s default timeout and N sequential
 * logins against bcrypt will exceed it. Suites set `setupTimeout: '180s'`.
 */
export function mintTokenPool(count, pattern = SEED.consumerEmailPattern) {
  const pool = [];

  for (let i = 0; i < count; i++) {
    const email = seedEmail(pattern, i);
    const session = login(email, SEED.password);
    if (session) {
      pool.push(session);
    }
  }

  if (pool.length === 0) {
    throw new Error(
      `Could not authenticate any seeded user for pattern "${pattern}". ` +
        'Run the seed script first: pnpm --filter @foodwaste/backend seed:loadtest',
    );
  }

  return pool;
}

export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } },
  );

  if (res.status !== 200 && res.status !== 201) {
    loginFailures.add(1);
    return null;
  }

  let body;
  try {
    body = JSON.parse(res.body);
  } catch {
    loginFailures.add(1);
    return null;
  }

  // Tokens are nested under `data.tokens`, and the user's id is `userId`, not
  // `_id`. Getting this wrong fails silently in the worst way: login returns
  // 200, so nothing looks broken, and the pool just comes back empty.
  const tokens = body.data ? body.data.tokens : null;

  if (!tokens || !tokens.accessToken) {
    loginFailures.add(1);
    return null;
  }

  return {
    email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    userId: body.data.user ? body.data.user.userId : null,
  };
}

function refresh(session) {
  const res = http.post(
    `${BASE_URL}/auth/refresh`,
    JSON.stringify({ refreshToken: session.refreshToken }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_refresh' } },
  );

  if (res.status !== 200 && res.status !== 201) {
    return false;
  }

  try {
    const body = JSON.parse(res.body);
    session.accessToken = body.data.accessToken;
    session.refreshToken = body.data.refreshToken;
    tokenRefreshes.add(1);
    return true;
  } catch {
    return false;
  }
}

export function headers(session) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

export function authParams(session, extra = {}) {
  return { ...extra, headers: { ...headers(session), ...(extra.headers || {}) } };
}

/**
 * Runs a request and, on a single 401, refreshes the token and retries once.
 *
 * Access tokens live ~15 minutes and the soak runs for two hours, so without
 * this every VU dies a quarter of the way in. It is not a testing workaround:
 * the real clients refresh on 401 too, so the soak exercises that path as a
 * side effect. A second consecutive 401 is a genuine failure and is returned
 * as-is rather than retried.
 */
export function withAuth(session, request) {
  const res = request(authParams(session));

  if (res.status !== 401) {
    return res;
  }

  if (!refresh(session)) {
    return res;
  }

  return request(authParams(session));
}
