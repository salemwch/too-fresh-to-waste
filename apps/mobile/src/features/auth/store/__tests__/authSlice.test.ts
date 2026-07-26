/**
 * authSlice reducers — the navigation state machine
 *
 * `flowState` is what RootNavigator switches on, so a wrong transition here does
 * not throw, it silently strands the user on the wrong screen (or worse, logs
 * out a session that was merely offline). These tests pin the transitions rather
 * than the thunks: the thunks talk to the network, the reducers are the
 * decisions.
 *
 * Only the reducer is exercised — no store, no dispatch — so each case reads as
 * "given this state and this action, the user ends up here".
 */

import authReducer, {
  clearError,
  updateUser,
  setFlowState,
  sessionRecoveryStarted,
  sessionRecoveryFinished,
  forceLocalLogout,
  loginAsync,
  refreshTokenAsync,
  logoutAsync,
} from '../authSlice';
import { AuthFlowState } from '../../types';

import type { AuthState, User } from '../../types';

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/services/SecureStorage', () => ({
  SecureStorage: {},
  KeychainLockedError: class extends Error {},
}));
jest.mock('@/utils/backgroundStorage', () => ({ backgroundStorage: {} }));
jest.mock('@/utils/errorHandler', () => ({ ErrorHandler: { handle: jest.fn() } }));
jest.mock('../../services/authService', () => ({ authService: {} }));

/** The reducer's own initial state, obtained the way Redux obtains it. */
const initial = authReducer(undefined, { type: '@@INIT' }) as AuthState;

const user = { userId: 'u1', email: 'a@b.com', isEmailVerified: true } as User;

const authenticated: AuthState = {
  ...initial,
  user,
  isAuthenticated: true,
  flowState: AuthFlowState.AUTHENTICATED,
};

describe('authSlice reducers', () => {
  describe('simple state setters', () => {
    it('clears a previous error', () => {
      const next = authReducer({ ...initial, error: 'boom' }, clearError());
      expect(next.error).toBeUndefined();
    });

    it('merges a partial user update', () => {
      const next = authReducer(authenticated, updateUser({ firstName: 'Sam' } as Partial<User>));
      expect(next.user).toMatchObject({ userId: 'u1', firstName: 'Sam' });
    });

    // Guards against a partial update resurrecting a logged-out user.
    it('ignores a user update when nobody is logged in', () => {
      const next = authReducer(initial, updateUser({ firstName: 'Sam' } as Partial<User>));
      expect(next.user).toBeNull();
    });

    it('applies a manual flow state transition', () => {
      const next = authReducer(initial, setFlowState(AuthFlowState.UNAUTHENTICATED));
      expect(next.flowState).toBe(AuthFlowState.UNAUTHENTICATED);
    });
  });

  describe('session recovery gate', () => {
    // Protected queries wait on this flag. If it were ever left true, they
    // would stay gated forever and the app would look permanently empty.
    it('raises and lowers the gate', () => {
      const started = authReducer(authenticated, sessionRecoveryStarted());
      expect(started.isRecoveringSession).toBe(true);

      expect(authReducer(started, sessionRecoveryFinished()).isRecoveringSession).toBe(false);
    });
  });

  describe('forceLocalLogout', () => {
    // Used by the 401 interceptor when refresh fails. It must NOT call the
    // logout API, or the failing 401 would loop forever.
    it('resets to a clean session-expired state', () => {
      const dirty: AuthState = {
        ...authenticated,
        error: 'boom',
        isRecoveringSession: true,
      };

      const next = authReducer(dirty, forceLocalLogout());

      expect(next).toEqual({ ...initial, flowState: AuthFlowState.SESSION_EXPIRED });
      expect(next.user).toBeNull();
      expect(next.isAuthenticated).toBe(false);
    });
  });

  describe('loginAsync', () => {
    const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };

    it('clears a stale error while the request is in flight', () => {
      const next = authReducer({ ...initial, error: 'old' }, loginAsync.pending('', {} as never));
      expect(next.isLoading).toBe(true);
      expect(next.error).toBeUndefined();
    });

    it('authenticates and stamps the session expiry on success', () => {
      const next = authReducer(
        initial,
        loginAsync.fulfilled({ user, tokens } as never, '', {} as never),
      );

      expect(next.flowState).toBe(AuthFlowState.AUTHENTICATED);
      expect(next.isAuthenticated).toBe(true);
      expect(next.user).toEqual(user);
      expect(next.isUserSynced).toBe(true);
      expect(Date.parse(next.sessionExpiresAt as string)).toBeGreaterThan(Date.now());
    });

    // MFA is the dangerous case: the reducer must NOT mark the user
    // authenticated, or RootNavigator would drop them straight into the app
    // with the second factor unsatisfied.
    it('withholds authentication when MFA is required', () => {
      const next = authReducer(
        initial,
        loginAsync.fulfilled({ requiresMFA: true, mfaToken: 'mfa-1' } as never, '', {} as never),
      );

      expect(next.flowState).toBe(AuthFlowState.MFA_REQUIRED);
      expect(next.mfaToken).toBe('mfa-1');
      expect(next.isAuthenticated).toBe(false);
      expect(next.user).toBeNull();
    });

    it('routes an admin-created account to the forced password change', () => {
      const mustChange = { ...user, requiresPasswordChange: true } as User;

      const next = authReducer(
        initial,
        loginAsync.fulfilled({ user: mustChange, tokens } as never, '', {} as never),
      );

      expect(next.flowState).toBe(AuthFlowState.PASSWORD_CHANGE_REQUIRED);
      expect(next.isAuthenticated).toBe(true);
      // Not a complete session yet — the expiry stamp is deliberately not set.
      expect(next.sessionExpiresAt).toBeNull();
    });

    it('clears the pending MFA token on a later clean login', () => {
      const afterMfa = authReducer(
        initial,
        loginAsync.fulfilled({ requiresMFA: true, mfaToken: 'mfa-1' } as never, '', {} as never),
      );

      const next = authReducer(
        afterMfa,
        loginAsync.fulfilled({ user, tokens } as never, '', {} as never),
      );

      expect(next.mfaToken).toBeUndefined();
    });

    it('surfaces the server message on failure', () => {
      const next = authReducer(
        initial,
        loginAsync.rejected(null, '', {} as never, { message: 'Invalid credentials' } as never),
      );

      expect(next.error).toBe('Invalid credentials');
      expect(next.flowState).toBe(AuthFlowState.UNAUTHENTICATED);
      expect(next.isAuthenticated).toBe(false);
    });

    // Rule 4 of the completeness protocol: no technical text reaches the user.
    it('falls back to a human message when the server sends none', () => {
      const next = authReducer(
        initial,
        loginAsync.rejected(null, '', {} as never, undefined as never),
      );
      expect(next.error).toBe('Login failed');
    });
  });

  describe('refreshTokenAsync.rejected — offline must not mean logged out', () => {
    const reject = (payload: unknown, state = authenticated) =>
      authReducer(
        state,
        refreshTokenAsync.rejected(null, '', undefined as never, payload as never),
      );

    // The regression this guards: treating a flaky connection as an expired
    // session, which logged people out on the metro.
    it('keeps the session when the failure was a network error', () => {
      const next = reject({ isNetworkError: true, message: 'Network request failed' });

      expect(next.isAuthenticated).toBe(true);
      expect(next.user).toEqual(user);
      expect(next.flowState).toBe(AuthFlowState.AUTHENTICATED);
      expect(next.error).toBeUndefined();
    });

    it('routes a suspended account to its own screen, not to login', () => {
      const next = reject({ isAccountSuspended: true });

      expect(next.flowState).toBe(AuthFlowState.ACCOUNT_SUSPENDED);
      expect(next.isAuthenticated).toBe(false);
      expect(next.user).toBeNull();
      expect(next.error).toMatch(/suspended/i);
    });

    it('expires the session on a genuine auth failure', () => {
      const next = reject({ message: 'Invalid refresh token' });

      expect(next.flowState).toBe(AuthFlowState.SESSION_EXPIRED);
      expect(next.isAuthenticated).toBe(false);
      expect(next.user).toBeNull();
      expect(next.error).toBe('Session expired. Please login again.');
    });

    // No payload at all (e.g. the thunk threw) is ambiguous. Expiring the
    // session is the safe reading — worst case the user logs in again.
    it('expires the session when the payload is missing', () => {
      expect(reject(undefined).flowState).toBe(AuthFlowState.SESSION_EXPIRED);
    });

    it('restores the session on a successful refresh', () => {
      const expired: AuthState = { ...initial, flowState: AuthFlowState.SESSION_EXPIRED, user };

      const next = authReducer(
        expired,
        refreshTokenAsync.fulfilled(
          { tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 } } as never,
          '',
          undefined as never,
        ),
      );

      expect(next.flowState).toBe(AuthFlowState.AUTHENTICATED);
      expect(next.isAuthenticated).toBe(true);
      expect(Date.parse(next.sessionExpiresAt as string)).toBeGreaterThan(Date.now());
    });
  });

  describe('logoutAsync', () => {
    it('clears the session on success', () => {
      const next = authReducer(
        authenticated,
        logoutAsync.fulfilled(undefined as never, '', undefined as never),
      );

      expect(next.isAuthenticated).toBe(false);
      expect(next.user).toBeNull();
    });

    // If a failed logout API call left the user signed in, the "log out"
    // button would appear to do nothing. Local state must clear regardless.
    it('clears the session even when the logout call failed', () => {
      const next = authReducer(
        authenticated,
        logoutAsync.rejected(new Error('offline'), '', undefined as never),
      );

      expect(next.isAuthenticated).toBe(false);
      expect(next.user).toBeNull();
    });
  });
});
