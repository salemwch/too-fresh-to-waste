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
} from './helpers/checks.js';

export default function () {
  // Public review endpoints (no auth)
  group('Public — All Reviews', () => {
    const reviews = http.get(
      `${BASE_URL}/reviews?page=1&limit=10`,
      { tags: { name: 'reviews_public_list' } },
    );
    checkPaginatedResponse(reviews, 'public reviews');
  });

  sleep(0.3);

  group('Public — Establishment Reviews', () => {
    // Get an establishment first
    const estList = http.get(`${BASE_URL}/proximity-search/establishments`, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'reviews_get_est' },
    });
    // Use POST for proximity search
    const proxRes = http.post(
      `${BASE_URL}/proximity-search/establishments`,
      JSON.stringify({
        latitude: 36.8065,
        longitude: 10.1815,
        radius: 10000,
        limit: 1,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'reviews_prox_est' },
      },
    );
    const establishments = extractData(proxRes);
    if (establishments && establishments.length > 0) {
      const estId = establishments[0]._id;

      const estReviews = http.get(
        `${BASE_URL}/reviews/establishment/${estId}?page=1&limit=10`,
        { tags: { name: 'reviews_by_establishment' } },
      );
      checkPaginatedResponse(estReviews, 'establishment reviews');

      const summary = http.get(
        `${BASE_URL}/reviews/establishment/${estId}/summary`,
        { tags: { name: 'reviews_summary' } },
      );
      checkResponse(summary, 'review summary');
    }
  });

  sleep(0.3);

  // Consumer reviews
  const consumer = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
  if (!consumer) return;

  group('Consumer — My Reviews', () => {
    const myReviews = http.get(
      `${BASE_URL}/reviews/my-reviews?page=1&limit=10`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'reviews_my_reviews' },
      },
    );
    checkPaginatedResponse(myReviews, 'my reviews');
  });

  sleep(0.3);

  // Merchant reviews (requires Pro subscription)
  const merchant = login(TEST_MERCHANT_EMAIL, TEST_MERCHANT_PASSWORD);
  if (!merchant) return;

  group('Merchant — Reviews Dashboard', () => {
    const merchantReviews = http.get(
      `${BASE_URL}/reviews/merchant/reviews?page=1&limit=10`,
      {
        headers: authHeaders(merchant.accessToken),
        tags: { name: 'reviews_merchant' },
      },
    );
    // May return 403 if not Pro tier — both are valid
    checkResponse(merchantReviews, 'merchant reviews');
  });
}
