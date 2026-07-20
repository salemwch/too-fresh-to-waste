// Spike Test — sudden traffic burst (e.g., viral post, lunch rush notification)
// Tests how the system handles sudden 10x traffic spikes and recovery
// Run: k6 run tests/k6/scenarios/spike.test.js --env ENV=staging

import { group, sleep } from 'k6';

import healthTests from '../tests/health.test.js';
import offersTests from '../tests/offers.test.js';
import establishmentsTests from '../tests/establishments.test.js';

export const options = {
  stages: [
    { duration: '30s', target: 5 },    // normal baseline
    { duration: '10s', target: 80 },   // spike!
    { duration: '1m', target: 80 },    // sustained spike
    { duration: '10s', target: 5 },    // spike drops
    { duration: '2m', target: 5 },     // recovery period
    { duration: '30s', target: 0 },    // wind down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.20'],
    checks: ['rate>0.75'],
  },
};

export default function () {
  // Focus on the highest-traffic consumer paths during a spike
  group('Health', () => healthTests());
  sleep(0.3);

  group('Offers (spike target)', () => offersTests());
  sleep(0.5);

  group('Establishments', () => establishmentsTests());
  sleep(0.5);
}
