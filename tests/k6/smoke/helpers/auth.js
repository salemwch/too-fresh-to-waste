import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../../config.js';

// Authenticates and returns { accessToken, refreshToken, cookies }
export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login' },
    },
  );

  const success = check(res, {
    'login status 200/201': (r) => r.status === 200 || r.status === 201,
    'login returns data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'success' && body.data;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.error(`Login failed for ${email}: ${res.status} ${res.body}`);
    return null;
  }

  const body = JSON.parse(res.body);
  return {
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    user: body.data.user,
    cookies: res.cookies,
  };
}

export function refreshToken(token) {
  const res = http.post(
    `${BASE_URL}/auth/refresh`,
    JSON.stringify({ refreshToken: token }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_refresh' },
    },
  );

  if (res.status !== 200 && res.status !== 201) {
    console.error(`Refresh failed: ${res.status}`);
    return null;
  }

  const body = JSON.parse(res.body);
  return {
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
  };
}

// Returns headers with Authorization bearer token
export function authHeaders(accessToken) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

// Returns params object with auth headers for use with k6 http methods
export function authParams(accessToken, extraTags) {
  return {
    headers: authHeaders(accessToken),
    tags: extraTags || {},
  };
}
