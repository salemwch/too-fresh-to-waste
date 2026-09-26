/**
 * @jest-environment jsdom
 *
 * The web login contract for the new login responses.
 *
 * 1. The login page shows the backend's message, which the backend has
 *    already translated (Accept-Language), for the generic 401 and the 429
 *    attempt limit alike - and a translated fallback only when there is none.
 * 2. A failed login is not treated as an expired session. The 401 interceptor
 *    refreshes and retries; on /auth/login that would turn "wrong password"
 *    into a refresh call, a logout and, on refresh failure, a redirect.
 */
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

import { apiClient } from '../api-client';
import { parseLoginError } from '../login-error';

const t = (key: string) => `t:${key}`;

/** An adapter that answers every request with this status and body. */
const answering =
  (status: number, data: unknown): AxiosAdapter =>
  async config => {
    const response = { data, status, statusText: '', headers: {}, config };
    throw new AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_REQUEST',
      config as InternalAxiosRequestConfig,
      null,
      response,
    );
  };

describe('parseLoginError', () => {
  it.each([
    [
      401,
      {
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou mot de passe incorrect.',
      },
      'E-mail ou mot de passe incorrect.',
    ],
    [
      429,
      {
        status: 429,
        code: 'LOGIN_TEMPORARILY_BLOCKED',
        message: 'محاولات تسجيل دخول كثيرة جدًا. انتظر ثم حاول لاحقًا.',
        details: { blockedUntil: '2026-09-25T12:15:00.000Z' },
      },
      'محاولات تسجيل دخول كثيرة جدًا. انتظر ثم حاول لاحقًا.',
    ],
    [
      403,
      { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email.' },
      'Please verify your email.',
    ],
  ])('%i %j -> the backend message, as sent', async (status, body, shown) => {
    const error = await apiClient
      .post('/auth/login', {}, { adapter: answering(status, body) })
      .catch((e: unknown) => e);

    expect(parseLoginError(error, t)).toBe(shown);
  });

  it('a response with no message -> the translated generic login error', () => {
    expect(parseLoginError({ response: { status: 502, data: '' } }, t)).toBe('t:loginError');
  });

  it.each([new Error('Network Error'), null, undefined, { response: {} }])(
    'no HTTP response (%j) -> the translated network error',
    error => {
      expect(parseLoginError(error, t)).toBe('t:networkError');
    },
  );
});

describe('401 interceptor', () => {
  let refresh: jest.SpyInstance;

  beforeEach(() => {
    // The refresh call goes through the global axios, not apiClient.
    refresh = jest.spyOn(axios, 'post').mockRejectedValue(new Error('no refresh in tests'));
  });

  afterEach(() => {
    refresh.mockRestore();
  });

  it('does not refresh on a failed login, and rejects with the login error itself', async () => {
    const body = {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    };

    const error = await apiClient
      .post('/auth/login', {}, { adapter: answering(401, body) })
      .catch((e: unknown) => e);

    expect(refresh).not.toHaveBeenCalled();
    expect((error as AxiosError).response?.data).toEqual(body);
  });

  it('does refresh on a 401 from any other endpoint (control: the spy can see a refresh)', async () => {
    await apiClient
      .get('/auth/me', { adapter: answering(401, { code: 'UNAUTHORIZED' }) })
      .catch(() => undefined);

    expect(refresh).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh$/),
      {},
      {
        withCredentials: true,
      },
    );
  });
});

describe('refresh rejected for a disabled account', () => {
  // The backend answers a refresh for a non-ACTIVE user with 403
  // ACCOUNT_INACTIVE. The session must be cleared - the old check read a
  // top-level `error` field that never arrived, so it stayed "authenticated".
  it.each(['ACCOUNT_INACTIVE', 'ACCOUNT_SUSPENDED'])('403 %s clears the session', async code => {
    const { useAuthStore } = await import('../auth');
    const logout = jest
      .spyOn(useAuthStore.getState(), 'logout')
      .mockImplementation(() => undefined);
    const refresh = jest.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, null, {
        data: { status: 403, code, message: 'This account is not active.' },
        status: 403,
        statusText: '',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }),
    );
    const { performRefreshOnce } = await import('../api-client');

    await expect(performRefreshOnce()).rejects.toBeInstanceOf(AxiosError);
    expect(logout).toHaveBeenCalledTimes(1);

    refresh.mockRestore();
    logout.mockRestore();
  });
});
