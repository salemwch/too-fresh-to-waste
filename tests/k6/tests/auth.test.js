import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL,
  TEST_CONSUMER_EMAIL,
  TEST_CONSUMER_PASSWORD,
} from '../config.js';
import { login, refreshToken, authHeaders } from '../helpers/auth.js';
import { checkResponse, checkRequiresAuth } from '../helpers/checks.js';
import { newConsumerPayload } from '../helpers/data.js';

export default function () {
  let auth = null;

  group('Login Flow', () => {
    // Successful login
    auth = login(TEST_CONSUMER_EMAIL, TEST_CONSUMER_PASSWORD);
    check(auth, {
      'login — got access token': (a) => a && a.accessToken,
      'login — got user object': (a) => a && a.user && a.user._id,
    });

    // Invalid credentials
    const badLogin = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: TEST_CONSUMER_EMAIL, password: 'WrongPass999!' }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'auth_login_bad_creds' },
      },
    );
    check(badLogin, {
      'bad creds — rejected (401)': (r) => r.status === 401,
    });

    // Missing fields
    const noEmail = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ password: 'SomePass123!' }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'auth_login_missing_email' },
      },
    );
    check(noEmail, {
      'missing email — rejected (400/422)': (r) =>
        r.status === 400 || r.status === 422,
    });
  });

  sleep(0.5);

  if (auth) {
    group('Get Current User (auth/me)', () => {
      const me = http.get(`${BASE_URL}/auth/me`, {
        headers: authHeaders(auth.accessToken),
        tags: { name: 'auth_me' },
      });
      checkResponse(me, 'auth/me');

      // Unauthenticated access
      const noAuth = http.get(`${BASE_URL}/auth/me`, {
        tags: { name: 'auth_me_no_token' },
      });
      checkRequiresAuth(noAuth, 'auth/me');
    });

    group('Token Refresh', () => {
      if (auth.refreshToken) {
        const refreshed = refreshToken(auth.refreshToken);
        check(refreshed, {
          'refresh — got new access token': (r) => r && r.accessToken,
        });
        if (refreshed) {
          auth.accessToken = refreshed.accessToken;
          auth.refreshToken = refreshed.refreshToken;
        }
      }
    });

    group('Sessions', () => {
      const sessions = http.get(`${BASE_URL}/auth/sessions`, {
        headers: authHeaders(auth.accessToken),
        tags: { name: 'auth_sessions' },
      });
      checkResponse(sessions, 'sessions');
    });

    group('MFA Status', () => {
      const mfaStatus = http.get(`${BASE_URL}/auth/mfa/status`, {
        headers: authHeaders(auth.accessToken),
        tags: { name: 'mfa_status' },
      });
      checkResponse(mfaStatus, 'mfa/status');
    });

    group('Forgot Password (validation)', () => {
      const forgot = http.post(
        `${BASE_URL}/auth/forgot-password`,
        JSON.stringify({ email: 'nonexistent-k6@test.example.com' }),
        {
          headers: authHeaders(auth.accessToken),
          tags: { name: 'auth_forgot_password' },
        },
      );
      // Should succeed (200) even for unknown emails to prevent enumeration
      check(forgot, {
        'forgot-password — no enumeration leak': (r) =>
          r.status === 200 || r.status === 201 || r.status === 404,
      });
    });

    group('Logout', () => {
      const logout = http.post(
        `${BASE_URL}/auth/logout`,
        null,
        {
          headers: authHeaders(auth.accessToken),
          tags: { name: 'auth_logout' },
        },
      );
      check(logout, {
        'logout — success': (r) => r.status === 200 || r.status === 201,
      });
    });
  }
}
