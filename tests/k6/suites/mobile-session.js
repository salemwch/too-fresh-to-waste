// tests/k6/suites/mobile-session.js
//
// Mobile session lifecycle. Requires JWT_EXPIRES_IN=30s.
//
//   k6 run tests/k6/suites/mobile-session.js --env ENV=docker

import { SEED, seedEmail } from '../config/environments.js';
import { MOBILE_SESSION_THRESHOLDS } from '../lib/contracts/mobile-session.js';
import { login } from '../lib/auth.js';
import { summaryHandler } from '../lib/summary.js';
import {
  normalLifecycle,
  expiredTokenRefresh,
  tokenReuseDetection,
  concurrentRefresh,
} from '../journeys/consumer-mobile-session.js';

export const options = {
  scenarios: {
    normal_lifecycle: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '7m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'normalLifecycleExec',
      tags: { scenario: 'normal_lifecycle' },
    },
    expired_token_refresh: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      exec: 'expiredTokenExec',
      startTime: '0s',
      maxDuration: '120s',
      tags: { scenario: 'expired_token' },
    },
    token_reuse_detection: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      exec: 'tokenReuseExec',
      startTime: '130s',
      maxDuration: '60s',
      tags: { scenario: 'token_reuse' },
    },
    concurrent_refresh: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      exec: 'concurrentRefreshExec',
      startTime: '200s',
      maxDuration: '60s',
      tags: { scenario: 'concurrent_refresh' },
    },
  },
  thresholds: MOBILE_SESSION_THRESHOLDS,
  setupTimeout: '180s',
};

export function setup() {
  // Credentials for lifecycle scenarios
  const sessions = [];
  for (let i = 20; i < 40; i++) {
    sessions.push({
      email: seedEmail(SEED.consumerEmailPattern, i),
      password: SEED.password,
    });
  }

  // Pre-login shared sessions for concurrent refresh test
  const sharedSessions = [];
  for (let i = 40; i < 45; i++) {
    const s = login(seedEmail(SEED.consumerEmailPattern, i), SEED.password);
    if (s) sharedSessions.push(s);
  }

  return { sessions, sharedSessions };
}

export function normalLifecycleExec(state) {
  const cred = state.sessions[(__VU - 1) % state.sessions.length];
  normalLifecycle(cred);
}

export function expiredTokenExec(state) {
  const cred = state.sessions[(__VU - 1) % state.sessions.length];
  expiredTokenRefresh(cred);
}

export function tokenReuseExec(state) {
  const cred = state.sessions[(__VU - 1) % state.sessions.length];
  tokenReuseDetection(cred);
}

export function concurrentRefreshExec(state) {
  concurrentRefresh(state);
}

export const handleSummary = summaryHandler('mobile-session');
