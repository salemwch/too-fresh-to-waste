import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL,
  TEST_CONSUMER_EMAIL,
  TEST_CONSUMER_PASSWORD,
} from '../config.js';
import { login, authHeaders } from './helpers/auth.js';
import { checkResponse, checkPaginatedResponse } from './helpers/checks.js';

export default function () {
  const consumer = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
  if (!consumer) return;

  group('Notifications — List', () => {
    const list = http.get(
      `${BASE_URL}/notifications?page=1&limit=20`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'notifications_list' },
      },
    );
    checkPaginatedResponse(list, 'notifications list');
  });

  group('Notifications — Unread Count', () => {
    const count = http.get(`${BASE_URL}/notifications/unread/count`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'notifications_unread_count' },
    });
    checkResponse(count, 'unread count');
  });

  group('Notifications — Preferences', () => {
    const prefs = http.get(`${BASE_URL}/notifications/preferences`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'notifications_prefs' },
    });
    checkResponse(prefs, 'notification preferences');
  });

  sleep(0.3);

  group('Notifications — Mark All Read', () => {
    const markAll = http.patch(
      `${BASE_URL}/notifications/read/all`,
      null,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'notifications_mark_all_read' },
      },
    );
    check(markAll, {
      'mark all read — success': (r) =>
        r.status === 200 || r.status === 201,
    });
  });
}
