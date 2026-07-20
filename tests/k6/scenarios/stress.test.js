// Stress Test — push beyond normal capacity to find breaking points
// Ramps to 50 VUs (2-3x expected load) to identify degradation thresholds
// Run: k6 run tests/k6/scenarios/stress.test.js --env ENV=staging

import { group, sleep } from 'k6';
import { THRESHOLDS } from '../config.js';

import healthTests from '../tests/health.test.js';
import offersTests from '../tests/offers.test.js';
import ordersTests from '../tests/orders.test.js';
import establishmentsTests from '../tests/establishments.test.js';
import notificationsTests from '../tests/notifications.test.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // warm up
    { duration: '2m', target: 25 },   // normal load
    { duration: '2m', target: 50 },   // stress zone
    { duration: '2m', target: 75 },   // breaking point hunt
    { duration: '1m', target: 100 },  // peak stress
    { duration: '2m', target: 0 },    // recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.15'],
    checks: ['rate>0.80'],
  },
};

export default function () {
  group('Health', () => healthTests());
  sleep(0.5);

  group('Offers (high read)', () => offersTests());
  sleep(1);

  group('Establishments', () => establishmentsTests());
  sleep(1);

  group('Orders', () => ordersTests());
  sleep(0.5);

  group('Notifications', () => notificationsTests());
  sleep(1);
}
