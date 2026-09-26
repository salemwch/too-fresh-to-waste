import axios from 'axios';

import i18n from '@/i18n';

import { isAppError } from '@/utils/errorHandler';

import { loginAsync } from '../../store/thunks/signIn.thunks';
import { loginFailureOutcome } from '../loginFailure';

/**
 * The login client contract, end to end: a backend error body goes through
 * the real authService, the real loginAsync thunk and `.unwrap()` - exactly
 * what LoginScreen catches - and lands on one UI outcome.
 *
 * Why the whole chain and not the function alone: the bug this exists for
 * lived between the layers. The thunk rejects with a plain payload, the screen
 * gated the locked modal on `isAppError`, which needs a `timestamp` that
 * payload never has, so the modal could not open. Each layer looked right on
 * its own.
 */

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    code: 'ERR_BAD_REQUEST',
    isAxiosError: true,
    response: { status, data },
  });
}

/** What LoginScreen's catch receives for this response. */
async function rejectionFor(status: number, body: unknown): Promise<unknown> {
  (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(httpError(status, body));
  const pending = loginAsync({ email: 'a@b.com', password: 'Abcdefghij1!' })(
    jest.fn(),
    () => ({}),
    undefined,
  );
  try {
    await pending.unwrap();
  } catch (rejection) {
    return rejection;
  }
  throw new Error('login resolved, but the test needs it to reject');
}

const BLOCKED_UNTIL = '2026-09-25T12:15:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockImplementation(
    (e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true,
  );
});

describe('login failure -> UI outcome', () => {
  it('429 LOGIN_TEMPORARILY_BLOCKED opens the locked-account modal with its countdown', async () => {
    const rejection = await rejectionFor(429, {
      status: 429,
      code: 'LOGIN_TEMPORARILY_BLOCKED',
      message: 'Trop de tentatives de connexion. Patientez puis réessayez plus tard.',
      details: { blockedUntil: BLOCKED_UNTIL },
      errorId: 'e1',
    });

    // The old screen gate. It is false for every thunk rejection, which is
    // why the modal never opened; the outcome must not depend on it.
    expect(isAppError(rejection)).toBe(false);
    expect(loginFailureOutcome(rejection)).toEqual({
      kind: 'locked',
      code: 'LOGIN_TEMPORARILY_BLOCKED',
      blockedUntil: BLOCKED_UNTIL,
    });
  });

  it('429 with no blockedUntil falls back to the banner rather than a modal with no countdown', async () => {
    const rejection = await rejectionFor(429, {
      code: 'LOGIN_TEMPORARILY_BLOCKED',
      message: 'Too many sign-in attempts. Please wait and try again later.',
    });

    expect(loginFailureOutcome(rejection)).toEqual({
      kind: 'banner',
      code: 'LOGIN_TEMPORARILY_BLOCKED',
      offerResend: false,
    });
  });

  it('a locked account (ACCOUNT_LOCKED, after a correct password) opens the same modal', async () => {
    const rejection = await rejectionFor(401, {
      code: 'ACCOUNT_LOCKED',
      message: 'Your account is temporarily locked.',
      details: { type: 'ACCOUNT_LOCKED', blockedUntil: BLOCKED_UNTIL },
    });

    expect(loginFailureOutcome(rejection)).toMatchObject({
      kind: 'locked',
      blockedUntil: BLOCKED_UNTIL,
    });
  });

  it('401 INVALID_CREDENTIALS shows the backend message in the banner, on no field', async () => {
    const message = 'E-mail ou mot de passe incorrect.';
    const rejection = await rejectionFor(401, {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message,
      errorId: 'e2',
    });

    expect(loginFailureOutcome(rejection)).toEqual({
      kind: 'banner',
      code: 'INVALID_CREDENTIALS',
      offerResend: false,
    });
    // The banner renders state.auth.error, which the rejected reducer takes
    // from this message - translated by the backend, not rewritten here.
    expect((rejection as { message?: unknown }).message).toBe(message);
  });

  it('403 EMAIL_NOT_VERIFIED shows the banner with the resend prompt', async () => {
    const rejection = await rejectionFor(403, {
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Veuillez vérifier votre e-mail avant de vous connecter.',
    });

    expect(loginFailureOutcome(rejection)).toEqual({
      kind: 'banner',
      code: 'EMAIL_NOT_VERIFIED',
      offerResend: true,
    });
  });

  it('400 validation errors land inline on email/password only', async () => {
    const rejection = await rejectionFor(400, {
      code: 'VALIDATION_FAILED',
      message: 'Some fields are invalid.',
      errors: [
        { field: 'email', code: 'isEmail', message: 'Adresse e-mail invalide.' },
        { field: 'rememberMe', code: 'isBoolean', message: 'ignored' },
      ],
    });

    expect(loginFailureOutcome(rejection)).toEqual({
      kind: 'fields',
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'email', message: 'Adresse e-mail invalide.' }],
    });
  });

  it.each([null, undefined, 'boom', [], {}])('%j (unexpected rejection) -> plain banner', value => {
    expect(loginFailureOutcome(value)).toEqual({
      kind: 'banner',
      code: undefined,
      offerResend: false,
    });
  });
});

describe('login request language', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it.each(['fr', 'ar'])('asks the backend for errors in the app language (%s)', async language => {
    await i18n.changeLanguage(language);
    await rejectionFor(401, { code: 'INVALID_CREDENTIALS', message: 'x' });

    const config = (mockedAxios as unknown as jest.Mock).mock.calls[0]?.[0] as {
      headers: Record<string, string>;
    };
    expect(config.headers['Accept-Language']).toBe(language);
  });
});
