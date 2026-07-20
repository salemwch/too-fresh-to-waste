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
  // --- Consumer browsing offers ---
  const consumer = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
  if (!consumer) return;

  group('Consumer — Browse Offers', () => {
    const allOffers = http.get(`${BASE_URL}/offers?page=1&limit=10`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'offers_list' },
    });
    checkPaginatedResponse(allOffers, 'offers list');

    const featured = http.get(`${BASE_URL}/offers/featured?limit=5`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'offers_featured' },
    });
    checkResponse(featured, 'offers featured');

    const urgent = http.get(`${BASE_URL}/offers/urgent?limit=5`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'offers_urgent' },
    });
    checkResponse(urgent, 'offers urgent');

    const pickupToday = http.get(`${BASE_URL}/offers/pickup-today?limit=5`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'offers_pickup_today' },
    });
    checkResponse(pickupToday, 'offers pickup-today');

    const pickupTomorrow = http.get(
      `${BASE_URL}/offers/pickup-tomorrow?limit=5`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'offers_pickup_tomorrow' },
      },
    );
    checkResponse(pickupTomorrow, 'offers pickup-tomorrow');

    const nearby = http.get(
      `${BASE_URL}/offers/nearby?latitude=36.8065&longitude=10.1815&radius=5000&limit=10`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'offers_nearby' },
      },
    );
    checkResponse(nearby, 'offers nearby');

    const recommended = http.get(`${BASE_URL}/offers/recommended?limit=5`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'offers_recommended' },
    });
    checkResponse(recommended, 'offers recommended');
  });

  sleep(0.3);

  group('Consumer — Offer Detail', () => {
    const list = http.get(`${BASE_URL}/offers?page=1&limit=1`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'offers_for_detail' },
    });
    const offers = extractData(list);
    if (offers && offers.length > 0) {
      const offerId = offers[0]._id;
      const detail = http.get(`${BASE_URL}/offers/${offerId}`, {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'offer_detail' },
      });
      checkResponse(detail, 'offer detail');
    }
  });

  sleep(0.3);

  // --- Merchant offer management ---
  const merchant = login(TEST_MERCHANT_EMAIL, TEST_MERCHANT_PASSWORD);
  if (!merchant) return;

  group('Merchant — My Offers', () => {
    const myOffers = http.get(`${BASE_URL}/offers/my-offers?page=1&limit=10`, {
      headers: authHeaders(merchant.accessToken),
      tags: { name: 'offers_my_offers' },
    });
    checkPaginatedResponse(myOffers, 'merchant my-offers');
  });
}
