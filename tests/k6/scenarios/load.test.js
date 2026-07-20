// Load Test — simulates expected concurrent users over 5 minutes
// Models realistic traffic: consumers browsing, merchants checking orders
// Run: k6 run tests/k6/scenarios/load.test.js --env ENV=staging

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
  scenarios: {
    // Consumers browsing offers/establishments (heaviest traffic)
    consumer_browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // ramp up
        { duration: '3m', target: 20 },   // sustain peak
        { duration: '1m', target: 0 },    // ramp down
      ],
      exec: 'consumerBrowsing',
      tags: { scenario: 'consumer_browsing' },
    },

    // Merchants checking dashboard (lighter traffic)
    merchant_dashboard: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 3 },
        { duration: '3m', target: 5 },
        { duration: '1m', target: 0 },
      ],
      exec: 'merchantDashboard',
      tags: { scenario: 'merchant_dashboard' },
    },

    // Auth operations (login/refresh)
    auth_flows: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1m',
      duration: '5m',
      preAllocatedVUs: 5,
      exec: 'authFlows',
      tags: { scenario: 'auth_flows' },
    },
  },
  thresholds: THRESHOLDS,
};

export function consumerBrowsing() {
  group('Browse Offers', () => offersTests());
  sleep(2);
  group('Browse Establishments', () => establishmentsTests());
  sleep(2);
  group('Check Favorites', () => favoritesTests());
  sleep(1);
  group('Notifications', () => notificationsTests());
  sleep(3);
}

export function merchantDashboard() {
  group('Merchant Orders', () => ordersTests());
  sleep(2);
  group('Reviews', () => reviewsTests());
  sleep(3);
  group('User Profile', () => userTests());
  sleep(2);
}

export function authFlows() {
  group('Auth', () => authTests());
  sleep(1);
}
