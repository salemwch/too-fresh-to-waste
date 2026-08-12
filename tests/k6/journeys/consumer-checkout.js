import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { withAuth } from '../lib/auth.js';
import { checkOk, data, parse, sample } from '../lib/envelope.js';
import { get, post } from '../lib/http.js';

export const orderCreateSuccess = new Rate('order_create_success');
export const outOfStock = new Counter('order_out_of_stock');
export const paymentConfirmed = new Counter('payment_confirmed');

/**
 * The revenue path, and the only journey that mutates state.
 *
 *   GET /offers/:id
 *     -> POST /orders                       (reserves stock atomically, inits payment)
 *     -> POST /payments/webhook/konnect     (@Public; the provider's callback)
 *     -> GET /orders/:id                    (poll, exactly as mobile does)
 *
 * There is deliberately no reserve step: `PATCH /offers/:id/reserve` is an
 * admin stock tool, and consumer reservation happens inside order creation as a
 * conditional $inc. There is no create-payment step either — order creation
 * calls initOrderPayment itself and hands back a payUrl.
 *
 * Requires PAYMENT_PROVIDER=stub, or the webhook's verification call goes to
 * the real Konnect API and returns early without settling anything.
 */
export function consumerCheckout(session) {
  // Pick something purchasable from the seeded bulk offers.
  const list = withAuth(session, params => get('/offers?page=1&limit=20', 'offers_list', params));
  const offer = sample(data(list));
  if (!offer || !offer._id) {
    return;
  }

  const detail = withAuth(session, params => get(`/offers/${offer._id}`, 'offer_detail', params));
  if (!checkOk(detail, 'checkout: offer detail')) {
    return;
  }

  const full = data(detail);
  const slot = sample(full && full.pickupTimeSlots);
  if (!slot) {
    // Stock reservation matches on an exact pickupTimeSlots entry, so an offer
    // without one can never be ordered. Seeded offers always carry slots.
    return;
  }

  sleep(randomIntBetween(1, 3));

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
        paymentMethod: 'online',
      },
      'order_create',
      params,
    ),
  );

  // A 400 INSUFFICIENT_STOCK is correct behaviour, not a failure — it is the
  // reservation guard doing its job. Only a 5xx or a malformed response counts
  // against the success rate, or the metric would punish the system for being
  // right whenever seeded stock runs low.
  const createdBody = parse(created);
  const isSuccess = created.status === 201 || created.status === 200;
  const isStockRejection =
    created.status === 400 &&
    createdBody !== null &&
    JSON.stringify(createdBody).includes('INSUFFICIENT_STOCK');

  orderCreateSuccess.add(isSuccess || isStockRejection);

  if (isStockRejection) {
    outOfStock.add(1);
    return;
  }

  if (!isSuccess) {
    return;
  }

  const order = data(created);
  const paymentRef =
    order && order.paymentSession ? order.paymentSession.reference : (order || {}).paymentRef;

  if (!order || !order._id || !paymentRef) {
    return;
  }

  sleep(randomIntBetween(1, 2));

  // The provider callback. Public by design — Konnect posts it unauthenticated.
  const webhook = post(
    `/payments/webhook/konnect`,
    { payment_ref: paymentRef },
    'payment_webhook',
  );
  check(webhook, { 'checkout: webhook acknowledged': r => r.status === 200 || r.status === 201 });

  sleep(randomIntBetween(2, 4));

  // Mobile polls order detail every 3s after returning from the payment page.
  const confirmed = withAuth(session, params =>
    get(`/orders/${order._id}`, 'order_detail', params),
  );
  const finalOrder = data(confirmed);

  const settled =
    finalOrder !== null && finalOrder.paymentStatus === 'paid';
  check(confirmed, {
    'checkout: order reflects payment': () => settled,
  });
  if (settled) {
    paymentConfirmed.add(1);
  }
}
