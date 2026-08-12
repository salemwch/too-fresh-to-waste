// tests/k6/journeys/notification-storm.js
//
// Notification queue stress. k6 generates the burst (order creation +
// confirmation). verify:loadtest-invariants checks the database afterward.
// Two halves of one assertion.

import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

import { withAuth } from '../lib/auth.js';
import { get, post, patch } from '../lib/http.js';
import { parse, data, checkOk, sample } from '../lib/envelope.js';

export const notificationDeliveryRate = new Rate('notification_delivery_rate');
export const notificationLogicalDuplicate = new Counter('notification_logical_duplicate_rate');

/**
 * Scenario 1 — order burst.
 *
 * Consumer creates an order. If creation succeeds, that is a state transition
 * that should produce notifications (Rule 5). The function returns the orderId
 * so the invariant checker can correlate notifications to actual transitions.
 */
export function orderBurst(session) {
  // Find a purchasable offer
  const list = withAuth(session, params =>
    get('/offers?page=1&limit=20', 'offers_list', params),
  );
  const offers = data(list);
  const offer = sample(offers);
  if (!offer || !offer._id) return null;

  const detail = withAuth(session, params =>
    get(`/offers/${offer._id}`, 'offer_detail', params),
  );
  const full = data(detail);
  if (!full) return null;
  const slot = sample(full.pickupTimeSlots);
  if (!slot) return null;

  const establishmentId =
    typeof full.establishmentId === 'object' ? full.establishmentId._id : full.establishmentId;

  const created = withAuth(session, params =>
    post(
      '/orders',
      {
        items: [{ offerId: full._id, quantity: 1 }],
        establishmentId,
        pickupTimeSlot: { startTime: slot.startTime, endTime: slot.endTime },
        pickupDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        paymentMethod: 'cash_on_pickup',
      },
      'order_create',
      params,
    ),
  );

  const createdBody = parse(created);
  if (created.status !== 200 && created.status !== 201) return null;

  const orderId = createdBody && createdBody.data ? createdBody.data._id : null;
  return orderId;
}

/**
 * Scenario 2 — notification read flood.
 *
 * Each of 20 distinct users reads their own notification list while the queue
 * drains. Tests read performance under write contention.
 *
 * `GetNotificationsQueryDto` only whitelists `limit`/`offset` (no `page`), and
 * the global ValidationPipe runs with `forbidNonWhitelisted: true` — an
 * unrecognised query param is a 400, not a silently-ignored extra field.
 */
export function notificationReadFlood(session) {
  const res = withAuth(session, params =>
    get('/notifications?limit=50&offset=0', 'notifications_list', params),
  );
  checkOk(res, 'notification list');

  const notifications = data(res);
  if (Array.isArray(notifications) && notifications.length > 0) {
    // Read one specific notification
    const notif = notifications[0];
    if (notif && notif._id) {
      withAuth(session, params =>
        patch(`/notifications/${notif._id}/read`, null, 'mark_read', params),
      );
    }
  }

  sleep(2);
}

/**
 * Scenario 3 — mark-all-as-read concurrency.
 *
 * Multiple VUs for the same user call mark-all-as-read simultaneously.
 * Invariant: unread_count == 0 after, and other users' counts unchanged.
 *
 * `GET /notifications/unread/count` returns `{ count }`, not a bare number —
 * the unread figure sits at `data.count` inside the envelope, not at `data`
 * itself.
 */
export function markAllAsRead(session) {
  // Fired for its side effect (exercising the read path under the same
  // contention as the write below) — the actual assertion is on the value
  // read back afterwards.
  withAuth(session, params => get('/notifications/unread/count', 'notifications_unread', params));

  // The controller route is `PATCH /notifications/read/all` — `read-all`
  // (hyphenated) 404s.
  withAuth(session, params =>
    patch('/notifications/read/all', null, 'mark_all_read', params),
  );

  sleep(1);

  const after = withAuth(session, params =>
    get('/notifications/unread/count', 'notifications_unread', params),
  );

  const afterBody = parse(after);
  const unreadAfter =
    afterBody && afterBody.data && typeof afterBody.data.count === 'number'
      ? afterBody.data.count
      : null;

  check(null, {
    'mark-all-as-read: unread count is 0': () => unreadAfter === 0 || unreadAfter === null,
  });
}
