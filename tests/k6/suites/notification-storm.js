// tests/k6/suites/notification-storm.js
//
// Notification queue stress. Requires PAYMENT_PROVIDER=stub for order creation.
//
//   k6 run tests/k6/suites/notification-storm.js --env ENV=docker
//   pnpm --filter @foodwaste/backend verify:loadtest-invariants

import { NOTIFICATION_THRESHOLDS } from '../lib/contracts/notification-storm.js';
import { mintTokenPool } from '../lib/auth.js';
import { summaryHandler } from '../lib/summary.js';
import {
  orderBurst,
  notificationReadFlood,
  markAllAsRead,
} from '../journeys/notification-storm.js';

export const options = {
  scenarios: {
    order_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '4m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'orderBurstExec',
      tags: { scenario: 'order_burst' },
    },
    notification_read_flood: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'readFloodExec',
      startTime: '60s',
      tags: { scenario: 'read_flood' },
    },
    mark_all_as_read: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 3,
      exec: 'markAllExec',
      startTime: '240s',
      maxDuration: '120s',
      tags: { scenario: 'mark_all_read' },
    },
  },
  thresholds: NOTIFICATION_THRESHOLDS,
  setupTimeout: '180s',
};

export function setup() {
  return {
    consumers: mintTokenPool(50),
    readFloodUsers: mintTokenPool(20),
    markAllUsers: mintTokenPool(10),
  };
}

function pick(pool) {
  return pool[(__VU - 1) % pool.length];
}

export function orderBurstExec(state) {
  orderBurst(pick(state.consumers));
}

export function readFloodExec(state) {
  notificationReadFlood(pick(state.readFloodUsers));
}

export function markAllExec(state) {
  markAllAsRead(pick(state.markAllUsers));
}

export const handleSummary = summaryHandler('notification-storm');
