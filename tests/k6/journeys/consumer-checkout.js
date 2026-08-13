import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { withAuth } from '../lib/auth.js';
import { checkOk, data, docId, parse, sample } from '../lib/envelope.js';
import { get, post } from '../lib/http.js';

export const orderCreateSuccess = new Rate('order_create_success');
export const outOfStock = new Counter('order_out_of_stock');
export const paymentConfirmed = new Counter('payment_confirmed');

// Counts iterations that gave up before reaching POST /orders because the
// catalogue held nothing purchasable. Without it the journey returns in
// silence and the whole suite reports green while never exercising the revenue
// path: `order_create_success` is a Rate, and a Rate with zero samples passes
// `rate>0.99`. That is not hypothetical — the 2026-08-13 gate run recorded
// 25443/25443 checks against an offers list that had been empty for six hours,
// every seeded offer having passed its availableUntil. Gated at count==0.
export const noPurchasableOffer = new Counter('checkout_no_purchasable_offer');

// Orders created but abandoned because no payment reference could be read off
// the response. Same reasoning as above: without it the webhook and settlement
// steps are skipped in silence. Gated at count==0.
export const missingPaymentRef = new Counter('checkout_missing_payment_ref');

/**
 * The provider's payment reference for a freshly created order.
 *
 * `POST /orders` does not return one as a field. It returns `payUrl`, and the
 * reference is that URL's last path segment — `.../payments/stub/stub-7000-ab12`
 * under the stub provider, and the Konnect payment id under the real one. The
 * journey had been reading `paymentSession.reference` and `paymentRef`, neither
 * of which exists on the response, so it abandoned every order it created
 * before ever calling the webhook.
 *
 * A real client never needs this: the customer opens `payUrl` and the provider
 * posts the callback itself. The load test has to play the provider, which is
 * why it has to recover the reference here.
 */
function paymentRefOf(order) {
  if (!order || typeof order.payUrl !== 'string') {
    return null;
  }
  const segments = order.payUrl.split('?')[0].split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : null;
}

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
  const offerId = docId(offer);
  if (!offerId) {
    noPurchasableOffer.add(1);
    return;
  }

  const detail = withAuth(session, params => get(`/offers/${offerId}`, 'offer_detail', params));
  if (!checkOk(detail, 'checkout: offer detail')) {
    return;
  }

  const full = data(detail);
  const slot = sample(full && full.pickupTimeSlots);
  if (!slot) {
    // Stock reservation matches on an exact pickupTimeSlots entry, so an offer
    // without one can never be ordered. Seeded offers always carry slots.
    noPurchasableOffer.add(1);
    return;
  }

  sleep(randomIntBetween(1, 3));

  const establishmentId =
    typeof full.establishmentId === 'object'
      ? docId(full.establishmentId)
      : full.establishmentId;

  const created = withAuth(session, params =>
    post(
      '/orders',
      {
        items: [{ offerId: docId(full), quantity: 1 }],
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
  const paymentRef = paymentRefOf(order);

  const orderId = docId(order);
  if (!orderId || !paymentRef) {
    missingPaymentRef.add(1);
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
    get(`/orders/${orderId}`, 'order_detail', params),
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
