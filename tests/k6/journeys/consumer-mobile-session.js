// tests/k6/journeys/consumer-mobile-session.js
//
// Mobile session lifecycle: login → browse → idle → rehydrate → refresh →
// browse → logout. Exercises the full token rotation contract.
//
// Requires JWT_EXPIRES_IN=30s in the target environment — the expired-token
// scenario waits for a real expiry rather than inferring it from timing.
//
// Scenarios 2-4 (expiredTokenRefresh, tokenReuseDetection, concurrentRefresh)
// intentionally use raw `k6/http` instead of the `lib/http.js` wrappers. Those
// wrappers exist to attach the `name` tag consistently, but nothing here needs
// `withAuth`'s auto-refresh-on-401 behaviour — the whole point of these
// scenarios is to observe the raw 401/expiry/reuse responses themselves, which
// `withAuth` would silently paper over by refreshing and retrying.

import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import encoding from 'k6/encoding';
import http from 'k6/http';

import { BASE_URL } from '../config/environments.js';
import { get, post } from '../lib/http.js';
import { parse, checkOk } from '../lib/envelope.js';

export const refreshAfterIdleSuccess = new Rate('refresh_after_idle_success');
export const expiredTokenRejected = new Rate('expired_token_rejected');
export const tokenReuseDetected = new Rate('token_reuse_detected');
export const familyRevocationVerified = new Rate('family_revocation_verified');
export const concurrentRefreshNo5xx = new Rate('concurrent_refresh_no_5xx');

/**
 * Decode a JWT payload (middle segment) for the exp/iat check in Rule 4.
 *
 * k6 has no global `atob` — use the `k6/encoding` module's base64 decoder
 * instead, after converting the token's base64url segment to standard base64.
 */
function decodeJwtPayload(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = encoding.b64decode(padded, 'std', 's');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function rawLogin(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } },
  );
  if (res.status !== 200 && res.status !== 201) return null;
  const body = parse(res);
  if (!body || !body.data || !body.data.tokens) return null;
  return {
    accessToken: body.data.tokens.accessToken,
    refreshToken: body.data.tokens.refreshToken,
    userId: body.data.user ? body.data.user.userId : null,
    email,
  };
}

function rawRefresh(refreshToken) {
  const res = http.post(
    `${BASE_URL}/auth/refresh`,
    JSON.stringify({ refreshToken }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_refresh' } },
  );
  return { res, body: parse(res) };
}

/**
 * Scenario 1 — normal session lifecycle.
 *
 * Login → GET /auth/me → browse → sleep → refresh → browse → logout.
 * Explicitly triggers refresh as a lifecycle event, not a real 13-minute
 * wait — the idle gap between browse and refresh stands in for it.
 */
export function normalLifecycle(session) {
  const s = rawLogin(session.email, session.password);
  if (!s) return;

  // Verify token has a bounded lifetime (exp/iat claims, not timing).
  // Docker compose uses 15m; production may use 30s-15m.
  const payload = decodeJwtPayload(s.accessToken);
  if (payload && payload.exp && payload.iat) {
    const ttl = payload.exp - payload.iat;
    check(null, {
      'jwt exp-iat confirms short-lived token': () => ttl <= 900,
    });
  }

  // Rehydrate
  const me = get('/auth/me', 'auth_me', {
    headers: { Authorization: `Bearer ${s.accessToken}` },
  });
  checkOk(me, 'session rehydrate');

  sleep(2);

  // Browse
  get('/offers?page=1&limit=10', 'offers_list', {
    headers: { Authorization: `Bearer ${s.accessToken}` },
  });

  sleep(3);

  // Refresh
  const { res: refreshRes, body: refreshBody } = rawRefresh(s.refreshToken);
  const refreshed = refreshRes.status === 200 || refreshRes.status === 201;
  refreshAfterIdleSuccess.add(refreshed ? 1 : 0);

  let latestAccessToken = s.accessToken;
  if (refreshed && refreshBody && refreshBody.data) {
    const newToken = refreshBody.data.accessToken || (refreshBody.data.tokens && refreshBody.data.tokens.accessToken);
    if (newToken) {
      latestAccessToken = newToken;
      // Browse with new token
      get('/offers?page=1&limit=10', 'offers_list', {
        headers: { Authorization: `Bearer ${newToken}` },
      });
    }
  }

  sleep(2);

  // Logout
  post('/auth/logout', null, 'auth_logout', {
    headers: { Authorization: `Bearer ${latestAccessToken}` },
  });
}

/**
 * Scenario 2 — expired access, valid refresh.
 *
 * Login → wait for real expiry (JWT_EXPIRES_IN=30s) → API call with stale
 * token → expect 401 → refresh → retry → expect 200.
 * Uses raw http.get() bypassing any auto-refresh helper.
 */
export function expiredTokenRefresh(session) {
  const s = rawLogin(session.email, session.password);
  if (!s) return;

  // Wait for access token to expire (30s in load-test env + small buffer)
  sleep(35);

  // Attempt API call with expired token — should get 401
  const staleRes = http.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${s.accessToken}`, 'Content-Type': 'application/json' },
    tags: { name: 'auth_me' },
  });

  const rejected = staleRes.status === 401;
  expiredTokenRejected.add(rejected ? 1 : 0);

  check(staleRes, {
    'expired token: rejected with 401': () => rejected,
  });

  // Refresh should still work
  const { res: refreshRes, body: refreshBody } = rawRefresh(s.refreshToken);
  const refreshed = refreshRes.status === 200 || refreshRes.status === 201;

  if (refreshed && refreshBody && refreshBody.data) {
    const newToken = refreshBody.data.accessToken || (refreshBody.data.tokens && refreshBody.data.tokens.accessToken);
    if (newToken) {
      const retryRes = http.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json' },
        tags: { name: 'auth_me' },
      });
      check(retryRes, {
        'expired token: retry with fresh token succeeds': r => r.status === 200,
      });
    }
  }
}

/**
 * Scenario 3 — token reuse detection.
 *
 * Login → refresh(A) → get B → refresh(A) again → expect 401 (reuse
 * detected) → refresh(B) → expect 401 (family revoked).
 */
export function tokenReuseDetection(session) {
  const s = rawLogin(session.email, session.password);
  if (!s) return;

  const tokenA = s.refreshToken;

  // First refresh: A → B (legitimate rotation)
  const { res: firstRes, body: firstBody } = rawRefresh(tokenA);
  if (firstRes.status !== 200 && firstRes.status !== 201) return;

  const tokenB = firstBody.data
    ? (firstBody.data.refreshToken || (firstBody.data.tokens && firstBody.data.tokens.refreshToken))
    : null;
  if (!tokenB) return;

  sleep(1);

  // Replay A — the already-consumed token. Should be detected as reuse.
  const { res: reuseRes } = rawRefresh(tokenA);
  const reuseDetected = reuseRes.status === 401;
  tokenReuseDetected.add(reuseDetected ? 1 : 0);

  check(reuseRes, {
    'token reuse: replayed token rejected': () => reuseDetected,
  });

  sleep(1);

  // Now try B — it should also be revoked (family-wide revocation)
  const { res: familyRes } = rawRefresh(tokenB);
  const familyRevoked = familyRes.status === 401;
  familyRevocationVerified.add(familyRevoked ? 1 : 0);

  check(familyRes, {
    'token reuse: family revocation verified': () => familyRevoked,
  });
}

/**
 * Scenario 4 — concurrent refresh with same token.
 *
 * Two VUs share the same credentials. Both refresh with the same token
 * simultaneously. At most one should succeed. Neither should 5xx.
 *
 * This function is designed for `per-vu-iterations` where pairs of VUs
 * share the same session from state.sharedSessions.
 */
export function concurrentRefresh(state) {
  if (!state.sharedSessions || state.sharedSessions.length === 0) return;

  // Each pair of VUs shares one session
  const sessionIdx = Math.floor((__VU - 1) / 2);
  const shared = state.sharedSessions[sessionIdx % state.sharedSessions.length];
  if (!shared || !shared.refreshToken) return;

  const { res } = rawRefresh(shared.refreshToken);

  concurrentRefreshNo5xx.add(res.status < 500 ? 1 : 0);

  check(res, {
    'concurrent refresh: no server error': r => r.status < 500,
  });
}
