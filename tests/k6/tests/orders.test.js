import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL,
  TEST_CONSUMER_EMAIL,
  TEST_CONSUMER_PASSWORD,
  TEST_MERCHANT_EMAIL,
  TEST_MERCHANT_PASSWORD,
} from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';
import {
  checkResponse,
  checkPaginatedResponse,
  extractData,
} from '../helpers/checks.js';

export default function () {
  const consumer = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
  if (!consumer) return;

  group('Consumer — My Orders', () => {
    const myOrders = http.get(
      `${BASE_URL}/orders/my-orders?page=1&limit=10`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'orders_my_orders' },
      },
    );
    checkPaginatedResponse(myOrders, 'consumer my-orders');
  });

  sleep(0.3);

  group('Consumer — Order Detail', () => {
    const list = http.get(
      `${BASE_URL}/orders/my-orders?page=1&limit=1`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'orders_for_detail' },
      },
    );
    const orders = extractData(list);
    if (orders && orders.length > 0) {
      const orderId = orders[0]._id;

      const detail = http.get(`${BASE_URL}/orders/${orderId}`, {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'order_detail' },
      });
      checkResponse(detail, 'order detail');

      const receipt = http.get(`${BASE_URL}/orders/${orderId}/receipt`, {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'order_receipt' },
      });
      check(receipt, {
        'receipt — 200 or 404': (r) => r.status === 200 || r.status === 404,
      });

      const qrCode = http.get(`${BASE_URL}/orders/${orderId}/qr-code`, {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'order_qr_code' },
      });
      check(qrCode, {
        'qr-code — 200 or 404': (r) => r.status === 200 || r.status === 404,
      });
    }
  });

  sleep(0.3);

  // Merchant order views
  const merchant = login(TEST_MERCHANT_EMAIL, TEST_MERCHANT_PASSWORD);
  if (!merchant) return;

  group('Merchant — Orders', () => {
    const merchantOrders = http.get(
      `${BASE_URL}/orders/merchant-orders?page=1&limit=10`,
      {
        headers: authHeaders(merchant.accessToken),
        tags: { name: 'orders_merchant' },
      },
    );
    checkPaginatedResponse(merchantOrders, 'merchant orders');

    const stats = http.get(`${BASE_URL}/orders/stats`, {
      headers: authHeaders(merchant.accessToken),
      tags: { name: 'orders_stats' },
    });
    checkResponse(stats, 'order stats');

    const revenueChart = http.get(
      `${BASE_URL}/orders/merchant-revenue-chart?period=30d`,
      {
        headers: authHeaders(merchant.accessToken),
        tags: { name: 'orders_revenue_chart' },
      },
    );
    checkResponse(revenueChart, 'revenue chart');
  });
}
