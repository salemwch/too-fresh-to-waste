/**
 * useCurrentUser — Phase 1 validation
 *
 * The migration's requirement is "confirm useCurrentUser returns identical user
 * data to Redux", plus the session scenarios. The property that matters most is
 * the negative one: this hook must NEVER return null while Redux holds a user,
 * because RootNavigator picks DriverStack vs MainStack from `user.role` and
 * ProtectedRoute gates on it. A null during the fetch window would drop a
 * driver into the consumer UI.
 *
 * Scenarios below map 1:1 to the validation matrix in
 * docs/plans/auth-state-ownership-audit.md.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockGet = jest.fn();
jest.mock('@/services/apiClient', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a) },
  unwrapBackendResponse: (r: { data: { data: unknown } }) => r.data.data,
}));

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

let mockAuthState: Record<string, unknown> = {};
jest.mock('@/hooks/redux', () => ({
  useAppSelector: (fn: (s: unknown) => unknown) => fn({ auth: mockAuthState }),
}));

import { useCurrentUser } from '../useCurrentUser';

const CONSUMER = { userId: 'u1', email: 'a@b.com', role: 'consumer', firstName: 'Amine' };
const DRIVER = { userId: 'u2', email: 'd@b.com', role: 'driver', firstName: 'Sami' };

const authedState = (user: unknown) => ({
  user,
  isAuthenticated: true,
  sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
});

const clients: QueryClient[] = [];

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queryClient);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCurrentUser(), { wrapper });
}

describe('useCurrentUser (Phase 1 parallel read)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { data: CONSUMER } });
    mockAuthState = authedState(CONSUMER);
  });

  afterEach(() => {
    clients.forEach(c => {
      c.cancelQueries();
      c.clear();
    });
    clients.length = 0;
  });

  describe('agreement with Redux', () => {
    it('returns the same user the server returns', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.isFresh).toBe(true));
      expect(result.current.user).toEqual(CONSUMER);
    });

    it('matches Redux when the server agrees', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.isFresh).toBe(true));
      expect(result.current.user).toEqual(mockAuthState['user']);
    });

    it('prefers the server copy once it lands', async () => {
      const updated = { ...CONSUMER, firstName: 'Renamed' };
      mockGet.mockResolvedValue({ data: { data: updated } });

      const { result } = setup();
      await waitFor(() => expect(result.current.user).toEqual(updated));
    });
  });

  // The driver-misrouting hazard, stated as tests.
  describe('never null while a session exists', () => {
    it('returns the Redux user immediately, before the fetch resolves', () => {
      const { result } = setup();
      // Synchronous first render — no await.
      expect(result.current.user).toEqual(CONSUMER);
    });

    it('preserves the DRIVER role during the fetch window', () => {
      mockAuthState = authedState(DRIVER);
      const { result } = setup();

      // If this were undefined, RootNavigator would render MainStack and put a
      // driver into the consumer app.
      expect(result.current.user?.role).toBe('driver');
    });

    it('keeps the driver role after the server responds', async () => {
      mockAuthState = authedState(DRIVER);
      mockGet.mockResolvedValue({ data: { data: DRIVER } });

      const { result } = setup();
      await waitFor(() => expect(result.current.isFresh).toBe(true));
      expect(result.current.user?.role).toBe('driver');
    });

    it('falls back to Redux when /auth/me fails', async () => {
      mockGet.mockRejectedValue(new Error('500'));
      const { result } = setup();

      await waitFor(() => expect(result.current.isRefreshing).toBe(false));
      expect(result.current.user).toEqual(CONSUMER);
    });

    // Offline cold start: the token is injected by apiClient's interceptor, so
    // a missing token or a dead network both surface here as a failed request.
    // Either way the restored Keychain identity must still be served.
    it('falls back to Redux when the request cannot be made (offline cold start)', async () => {
      mockGet.mockRejectedValue(new Error('Network request failed'));
      const { result } = setup();

      await waitFor(() => expect(result.current.isRefreshing).toBe(false));
      expect(result.current.user).toEqual(CONSUMER);
      expect(result.current.isFresh).toBe(false);
    });
  });

  describe('auth gating', () => {
    it('does not call /auth/me when unauthenticated', async () => {
      mockAuthState = { user: null, isAuthenticated: false, sessionExpiresAt: null };
      const { result } = setup();

      await waitFor(() => expect(result.current.isRefreshing).toBe(false));
      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    // Mid-refresh the session is momentarily expired; firing would 401.
    //
    // Note the 30s clock-skew tolerance in tokenValidator: an expiry 1s in the
    // past is still treated as valid, deliberately, so a slightly wrong device
    // clock does not lock people out. The timestamp here has to clear it.
    it('does not call /auth/me when the local session has expired', async () => {
      mockAuthState = {
        user: CONSUMER,
        isAuthenticated: true,
        sessionExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      };
      const { result } = setup();

      await waitFor(() => expect(result.current.isRefreshing).toBe(false));
      expect(mockGet).not.toHaveBeenCalled();
      // Still serves the restored identity — an expired access token does not
      // mean logged out; the refresh token may well be valid.
      expect(result.current.user).toEqual(CONSUMER);
    });

    it('returns null after logout clears Redux', async () => {
      mockAuthState = { user: null, isAuthenticated: false, sessionExpiresAt: null };
      const { result } = setup();

      await waitFor(() => expect(result.current.isRefreshing).toBe(false));
      expect(result.current.user).toBeNull();
    });
  });
});
