// tests/k6/lib/contracts/auth-security.js

// Throttle policies derived from auth.controller.ts decorator values.
// Every assertion references a named policy from this object.
export const THROTTLE_POLICIES = {
  login:           { limit: 10, ttlMs: 900_000,   label: '10/15min' },
  register:        { limit: 10, ttlMs: 600_000,   label: '10/10min' },
  forgotPassword:  { limit: 5,  ttlMs: 300_000,   label: '5/5min' },
  refresh:         { limit: 120, ttlMs: 3_600_000, label: '120/hour' },
};

export const AUTH_SECURITY_THRESHOLDS = {
  auth_leaked:                           ['count==0'],
  unexpected_server_errors:              ['count==0'],
  'http_req_duration{name:auth_login}':  ['p(95)<800'],
  legitimate_success_rate:               ['rate>=0.99'],
  'http_req_duration{name:legitimate_login}': ['p(95)<500'],
};
