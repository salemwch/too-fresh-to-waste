import http from 'k6/http';
import { group, sleep } from 'k6';
import {
  BASE_URL,
  TEST_CONSUMER_EMAIL,
  TEST_CONSUMER_PASSWORD,
  TEST_MERCHANT_EMAIL,
  TEST_MERCHANT_PASSWORD,
} from '../config.js';
import { login, authHeaders } from './helpers/auth.js';
import {
  checkResponse,
  checkPaginatedResponse,
  extractData,
  docId,
} from './helpers/checks.js';

export default function () {
  const consumer = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
  if (!consumer) return;

  group('Consumer — Browse Establishments', () => {
    const list = http.get(
      `${BASE_URL}/establishments?page=1&limit=10`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'establishments_list' },
      },
    );
    checkPaginatedResponse(list, 'establishments list');

    const nearby = http.get(
      `${BASE_URL}/establishments/nearby?latitude=36.8065&longitude=10.1815&maxDistance=5000&limit=10`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'establishments_nearby' },
      },
    );
    checkResponse(nearby, 'establishments nearby');
  });

  sleep(0.3);

  group('Consumer — Establishment Detail', () => {
    const list = http.get(
      `${BASE_URL}/establishments?page=1&limit=1`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'establishments_for_detail' },
      },
    );
    const items = extractData(list);
    if (items && items.length > 0) {
      const id = docId(items[0]);

      const detail = http.get(`${BASE_URL}/establishments/${id}`, {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'establishment_detail' },
      });
      checkResponse(detail, 'establishment detail');

      const stats = http.get(`${BASE_URL}/establishments/${id}/stats`, {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'establishment_stats' },
      });
      checkResponse(stats, 'establishment stats');
    }
  });

  sleep(0.3);

  group('Proximity Search', () => {
    const proxEstablishments = http.post(
      `${BASE_URL}/proximity-search/establishments`,
      JSON.stringify({
        latitude: 36.8065,
        longitude: 10.1815,
        radius: 5000,
        limit: 10,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'proximity_establishments' },
      },
    );
    checkResponse(proxEstablishments, 'proximity establishments');

    const mapEstablishments = http.post(
      `${BASE_URL}/proximity-search/map-establishments`,
      JSON.stringify({
        latitude: 36.8065,
        longitude: 10.1815,
        radius: 10000,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'proximity_map' },
      },
    );
    checkResponse(mapEstablishments, 'proximity map');
  });

  sleep(0.3);

  // Merchant own establishment
  const merchant = login(TEST_MERCHANT_EMAIL, TEST_MERCHANT_PASSWORD);
  if (!merchant) return;

  group('Merchant — My Establishment', () => {
    const myEstablishment = http.get(
      `${BASE_URL}/establishments/my-establishment`,
      {
        headers: authHeaders(merchant.accessToken),
        tags: { name: 'merchant_my_establishment' },
      },
    );
    checkResponse(myEstablishment, 'my-establishment');
  });
}
