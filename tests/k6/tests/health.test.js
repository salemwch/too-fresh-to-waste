import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL } from '../config.js';

// Health & public endpoints — no auth required
export default function () {
  group('Health Checks', () => {
    const health = http.get(`${BASE_URL}/../health`, {
      tags: { name: 'health' },
    });
    check(health, {
      'health — 200': (r) => r.status === 200,
    });

    const liveness = http.get(`${BASE_URL}/../health/liveness`, {
      tags: { name: 'health_liveness' },
    });
    check(liveness, {
      'liveness — 200': (r) => r.status === 200,
    });

    const readiness = http.get(`${BASE_URL}/../health/readiness`, {
      tags: { name: 'health_readiness' },
    });
    check(readiness, {
      'readiness — 200': (r) => r.status === 200,
    });
  });

  group('App Config', () => {
    const appVersion = http.get(`${BASE_URL}/config/app-version`, {
      tags: { name: 'config_app_version' },
    });
    check(appVersion, {
      'app-version — 200': (r) => r.status === 200,
    });
  });

  group('Public Stats', () => {
    const donationStats = http.get(`${BASE_URL}/donations/stats`, {
      tags: { name: 'donation_stats' },
    });
    check(donationStats, {
      'donation stats — 200': (r) => r.status === 200,
    });

    const communityGoal = http.get(`${BASE_URL}/community-goal/stats`, {
      tags: { name: 'community_goal_stats' },
    });
    check(communityGoal, {
      'community goal stats — 200': (r) => r.status === 200,
    });
  });

  group('Public Auth Endpoints', () => {
    const csrfToken = http.get(`${BASE_URL}/auth/csrf-token`, {
      tags: { name: 'csrf_token' },
    });
    check(csrfToken, {
      'csrf-token — 200': (r) => r.status === 200,
    });

    const passwordPolicy = http.get(`${BASE_URL}/auth/password-policy`, {
      tags: { name: 'password_policy' },
    });
    check(passwordPolicy, {
      'password-policy — 200': (r) => r.status === 200,
    });

    const strengthCheck = http.post(
      `${BASE_URL}/auth/check-password-strength`,
      JSON.stringify({ password: 'TestPassword123!' }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'password_strength' },
      },
    );
    check(strengthCheck, {
      'password-strength — 200/201': (r) => r.status === 200 || r.status === 201,
    });
  });

  group('Search Suggestions', () => {
    const suggestions = http.get(`${BASE_URL}/search/suggestions?q=pizza`, {
      tags: { name: 'search_suggestions' },
    });
    check(suggestions, {
      'search suggestions — 200': (r) => r.status === 200,
    });
  });

  group('Geolocation Public', () => {
    const autocomplete = http.get(
      `${BASE_URL}/geolocation/location/autocomplete?input=Tunis`,
      { tags: { name: 'geo_autocomplete' } },
    );
    check(autocomplete, {
      'geo autocomplete — 200': (r) => r.status === 200,
    });
  });
}
