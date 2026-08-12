import { sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { withAuth } from '../lib/auth.js';
import { checkList, checkOk } from '../lib/envelope.js';
import { get } from '../lib/http.js';

/**
 * The aggregation-heavy path: low VU count, high per-request cost — the classic
 * shape that starves everything else on a shared event loop.
 *
 * Think-time is long on purpose. A merchant refreshes a dashboard every few
 * minutes; modelling it as a tight loop would invent load that does not exist
 * and hide the fact that the real risk here is per-request cost, not volume.
 */
export function merchantDashboard(session) {
  const orders = withAuth(session, params =>
    get('/orders/merchant-orders?page=1&limit=20', 'merchant_orders', params),
  );
  checkList(orders, 'merchant orders');

  sleep(randomIntBetween(2, 5));

  const stats = withAuth(session, params => get('/orders/stats', 'merchant_stats', params));
  checkOk(stats, 'merchant stats');

  sleep(randomIntBetween(2, 5));

  const revenue = withAuth(session, params =>
    get('/orders/merchant-revenue-chart?period=30d', 'merchant_revenue', params),
  );
  checkOk(revenue, 'merchant revenue chart');

  sleep(randomIntBetween(10, 20));
}
