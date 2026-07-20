// Smoke Test — quick sanity check, 1 VU, 1 iteration per module
// Verifies all endpoints are reachable and responding correctly.
// Run: k6 run tests/k6/scenarios/smoke.test.js --env ENV=local

import { group, sleep } from 'k6';
import { THRESHOLDS } from '../config.js';

import healthTests from '../tests/health.test.js';
import authTests from '../tests/auth.test.js';
import offersTests from '../tests/offers.test.js';
import ordersTests from '../tests/orders.test.js';
import establishmentsTests from '../tests/establishments.test.js';
import favoritesTests from '../tests/favorites.test.js';
import reviewsTests from '../tests/reviews.test.js';
import notificationsTests from '../tests/notifications.test.js';
import userTests from '../tests/user.test.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.0'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  group('01 — Health & Public', () => healthTests());
  sleep(1);

  group('02 — Auth Flows', () => authTests());
  sleep(1);

  group('03 — Offers', () => offersTests());
  sleep(1);

  group('04 — Orders', () => ordersTests());
  sleep(1);

  group('05 — Establishments', () => establishmentsTests());
  sleep(1);

  group('06 — Favorites', () => favoritesTests());
  sleep(1);

  group('07 — Reviews', () => reviewsTests());
  sleep(1);

  group('08 — Notifications', () => notificationsTests());
  sleep(1);

  group('09 — User & Loyalty', () => userTests());
}
