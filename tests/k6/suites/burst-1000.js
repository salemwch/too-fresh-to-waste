// 1000-request burst test. 100 concurrent users, no think time.
// Each iteration fires 3 requests → 3000 total HTTP requests.
//
//   k6 run tests/k6/suites/burst-1000.js --env ENV=docker

import { check } from 'k6';
import { mintTokenPool } from '../lib/auth.js';
import { get } from '../lib/http.js';
import { SEED } from '../config/environments.js';

export const options = {
  scenarios: {
    burst: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 1000,
      maxDuration: '2m',
      exec: 'burst',
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:offers_list}': ['p(95)<3000'],
    'http_req_duration{name:urgent}': ['p(95)<3000'],
    'http_req_duration{name:nearby}': ['p(95)<3000'],
  },
  setupTimeout: '180s',
};

export function setup() {
  const consumers = mintTokenPool(
    Math.min(100, SEED.consumerCount),
    SEED.consumerEmailPattern,
  );
  return { consumers };
}

export function burst(data) {
  const session = data.consumers[(__VU - 1) % data.consumers.length];
  const auth = { headers: { Authorization: `Bearer ${session.accessToken}` } };

  const offers = get('/offers?page=1&limit=10', 'offers_list', auth);
  check(offers, { 'offers: 200': (r) => r.status === 200 });

  const urgent = get('/offers/urgent', 'urgent', auth);
  check(urgent, { 'urgent: 200': (r) => r.status === 200 });

  const nearby = get(
    '/offers/nearby?latitude=36.8065&longitude=10.1815&radius=5000&page=1&limit=10',
    'nearby',
    auth,
  );
  check(nearby, { 'nearby: 200': (r) => r.status === 200 });
}
