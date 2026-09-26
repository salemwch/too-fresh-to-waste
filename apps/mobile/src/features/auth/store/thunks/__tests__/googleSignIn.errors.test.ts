import { googleSignInAsync } from '../signIn.thunks';

/**
 * What a failed Google sign-in tells the user.
 *
 * The thunk matched English words ("locked", "too many") in the backend's
 * message. The backend answers in the app's language now, so in fr and ar a
 * lockout never matched and read as a generic failure. It branches on the
 * backend code first; the text matches remain only for an older backend.
 */

const mockGoogleSignIn = jest.fn();
jest.mock('../../../services/authService', () => ({
  authService: { googleSignIn: (...args: unknown[]) => mockGoogleSignIn(...args) },
}));

async function failureMessage(rejection: unknown): Promise<unknown> {
  mockGoogleSignIn.mockRejectedValueOnce(rejection);
  const action = await googleSignInAsync({ idToken: 'id-token' })(jest.fn(), () => ({}), undefined);
  return (action.payload as { message?: unknown } | undefined)?.message;
}

describe('googleSignInAsync failure message', () => {
  it.each([
    ['ACCOUNT_LOCKED', 'Votre compte est temporairement verrouillé.', 'auth.errorTooManyAttempts'],
    ['LOGIN_TEMPORARILY_BLOCKED', 'محاولات كثيرة جدًا.', 'auth.errorTooManyAttempts'],
    ['TOO_MANY_REQUESTS', 'Trop de requêtes.', 'auth.errorTooManyAttempts'],
    ['ACCOUNT_SUSPENDED', 'Ce compte est suspendu.', 'auth.errorAccountSuspended'],
    ['ACCOUNT_INACTIVE', 'Ce compte n’est pas actif.', 'auth.errorAccountInactive'],
    ['GOOGLE_TOKEN_INVALID', 'Connexion Google invalide.', 'auth.errorGoogleTokenInvalid'],
    ['TIMEOUT', 'timeout of 15000ms exceeded', 'auth.errorServerSlow'],
    ['OFFLINE', 'Network Error', 'auth.errorNoConnection'],
  ])('%s (message in any language) -> %s', async (errorCode, message, expected) => {
    expect(await failureMessage({ errorCode, message })).toBe(expected);
  });

  it("a backend code with no key of its own -> the backend's translated message", async () => {
    const message = 'Vérifiez d’abord votre adresse e-mail auprès de Google.';
    expect(await failureMessage({ errorCode: 'GOOGLE_EMAIL_UNVERIFIED', message })).toBe(message);
  });

  it('an older backend with no code still matches its English text', async () => {
    expect(await failureMessage(new Error('Account locked. Too many attempts.'))).toBe(
      'auth.errorTooManyAttempts',
    );
  });

  it('nothing to go on -> the generic Google failure', async () => {
    expect(await failureMessage(new Error('boom'))).toBe('auth.googleSignInFailed');
  });
});
