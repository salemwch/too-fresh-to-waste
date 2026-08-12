import http from 'k6/http';
import { group, sleep } from 'k6';
import {
  BASE_URL,
  TEST_CONSUMER_EMAIL,
  TEST_CONSUMER_PASSWORD,
} from '../config.js';
import { login, authHeaders } from './helpers/auth.js';
import { checkResponse } from './helpers/checks.js';

export default function () {
  const consumer = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
  if (!consumer) return;

  group('User — Profile', () => {
    const profile = http.get(`${BASE_URL}/users/profile`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'user_profile' },
    });
    checkResponse(profile, 'user profile');
  });

  group('User — Location Preferences', () => {
    const prefs = http.get(`${BASE_URL}/users/me/location-preferences`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'user_location_prefs' },
    });
    checkResponse(prefs, 'location preferences');
  });

  sleep(0.3);

  group('Loyalty — Account', () => {
    const account = http.get(`${BASE_URL}/loyalty/account`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'loyalty_account' },
    });
    checkResponse(account, 'loyalty account');

    const stats = http.get(`${BASE_URL}/loyalty/stats`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'loyalty_stats' },
    });
    checkResponse(stats, 'loyalty stats');

    const gamification = http.get(`${BASE_URL}/loyalty/gamification`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'loyalty_gamification' },
    });
    checkResponse(gamification, 'loyalty gamification');

    const leaderboard = http.get(`${BASE_URL}/loyalty/leaderboard?limit=10`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'loyalty_leaderboard' },
    });
    checkResponse(leaderboard, 'loyalty leaderboard');
  });

  sleep(0.3);

  group('Payments — Consumer History', () => {
    const payments = http.get(
      `${BASE_URL}/payments/my-consumer-payments?page=1&limit=10`,
      {
        headers: authHeaders(consumer.accessToken),
        tags: { name: 'payments_consumer' },
      },
    );
    checkResponse(payments, 'consumer payments');

    const payStats = http.get(`${BASE_URL}/payments/stats`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'payments_stats' },
    });
    checkResponse(payStats, 'payment stats');
  });

  group('Voting — Active Cycles', () => {
    const active = http.get(`${BASE_URL}/voting/active`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'voting_active' },
    });
    checkResponse(active, 'voting active');

    const history = http.get(`${BASE_URL}/voting/history`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'voting_history' },
    });
    checkResponse(history, 'voting history');
  });

  group('Privacy — Compliance', () => {
    const compliance = http.get(`${BASE_URL}/privacy/compliance/tunisia`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'privacy_compliance' },
    });
    checkResponse(compliance, 'privacy compliance');
  });

  group('User Location — Saved', () => {
    const saved = http.get(`${BASE_URL}/user-locations/saved`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'user_saved_locations' },
    });
    checkResponse(saved, 'saved locations');

    const prefs = http.get(`${BASE_URL}/user-locations/preferences`, {
      headers: authHeaders(consumer.accessToken),
      tags: { name: 'user_location_prefs_v2' },
    });
    checkResponse(prefs, 'location prefs');
  });
}
