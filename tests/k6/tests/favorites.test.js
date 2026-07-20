import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL,
  TEST_CONSUMER_EMAIL,
  TEST_CONSUMER_PASSWORD,
} from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';
import { checkResponse, extractData } from '../helpers/checks.js';

export default function () {
  const consumer = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
  if (!consumer) return;

  group('Favorites — List', () => {
    const list = http.get(`${BASE_URL}/favorites?page=1&limit=10`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'favorites_list' },
    });
    checkResponse(list, 'favorites list');
  });

  group('Favorites — IDs (quick check)', () => {
    const ids = http.get(`${BASE_URL}/favorites/ids`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'favorites_ids' },
    });
    checkResponse(ids, 'favorites ids');
  });

  group('Favorites — Stats', () => {
    const stats = http.get(`${BASE_URL}/favorites/stats`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'favorites_stats' },
    });
    checkResponse(stats, 'favorites stats');
  });

  sleep(0.3);

  group('Favorites — Toggle (idempotent)', () => {
    // Get an establishment to favorite
    const estList = http.get(`${BASE_URL}/establishments?page=1&limit=1`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'fav_get_establishment' },
    });
    const establishments = extractData(estList);
    if (establishments && establishments.length > 0) {
      const estId = establishments[0]._id;

      // Check if already favorited
      const checkFav = http.get(
        `${BASE_URL}/favorites/check/establishment/${estId}`,
        {
          headers: authHeaders(consumer.accessToken),
          tags: { name: 'favorites_check' },
        },
      );
      checkResponse(checkFav, 'favorites check');

      // Toggle favorite
      const toggle = http.post(
        `${BASE_URL}/favorites/toggle`,
        JSON.stringify({ itemType: 'establishment', itemId: estId }),
        {
          headers: authHeaders(consumer.accessToken),
          tags: { name: 'favorites_toggle' },
        },
      );
      check(toggle, {
        'toggle — success': (r) => r.status === 200 || r.status === 201,
      });

      // Toggle back to restore state
      sleep(0.2);
      http.post(
        `${BASE_URL}/favorites/toggle`,
        JSON.stringify({ itemType: 'establishment', itemId: estId }),
        {
          headers: authHeaders(consumer.accessToken),
          tags: { name: 'favorites_toggle_restore' },
        },
      );
    }
  });

  group('Favorites — Lists (collections)', () => {
    const lists = http.get(`${BASE_URL}/favorites/lists`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'favorites_lists' },
    });
    checkResponse(lists, 'favorite lists');
  });

  group('Favorites — Recommendations', () => {
    const recs = http.get(
      `${BASE_URL}/favorites/recommendations/based-on-favorites`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'favorites_recommendations' },
      },
    );
    checkResponse(recs, 'favorites recommendations');
  });

  group('Favorites — Trending', () => {
    const popular = http.get(`${BASE_URL}/favorites/trends/popular`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'favorites_popular' },
    });
    checkResponse(popular, 'favorites popular');
  });
}
