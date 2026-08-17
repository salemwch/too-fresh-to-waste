// tests/k6/lib/contracts/mobile-session.js

export const MOBILE_SESSION_THRESHOLDS = {
  'http_req_duration{name:auth_login}':   ['p(95)<800'],
  'http_req_duration{name:auth_refresh}': ['p(95)<300'],
  'http_req_duration{name:auth_me}':      ['p(95)<200'],
  'http_req_duration{name:auth_logout}':  ['p(95)<200'],
  refresh_after_idle_success:             ['rate>=0.99'],
  expired_token_rejected:                 ['rate==1.0'],
  token_reuse_detected:                   ['rate==1.0'],
  family_revocation_verified:             ['rate==1.0'],
  concurrent_refresh_no_5xx:              ['rate==1.0'],
};
