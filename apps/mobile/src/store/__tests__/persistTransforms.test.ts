/**
 * Persist transform — per-run flag handling.
 *
 * These exist because `isUserSynced` was silently persisted. It rehydrated as
 * `true`, so on cold start ProtectedRoute ran its email-verification gate
 * against the stale Keychain user before any /auth/me had happened: someone who
 * verified on another device was shown "Email Verification Required". It also
 * opened useCurrentUser's gate too early, costing a second /auth/me per launch.
 *
 * Nothing caught it, so the read path is asserted here directly.
 */

import { authTransform } from '../persistTransforms';

import type { AuthState } from '@/features/auth/types';

const KEY = 'auth';

const baseState = {
  user: { userId: 'u1', email: 'a@b.com', role: 'consumer' },
  isAuthenticated: true,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  lastLoginTime: 1,
  flowState: 'AUTHENTICATED',
} as unknown as AuthState;

describe('authTransform', () => {
  describe('inbound (what gets written to disk)', () => {
    const written = (state: Partial<AuthState>) =>
      authTransform.in({ ...baseState, ...state } as AuthState, KEY, {} as never) as Record<
        string,
        unknown
      >;

    it('does not write the per-run flags', () => {
      const result = written({ isUserSynced: true, isRecoveringSession: true });

      expect(result).not.toHaveProperty('isUserSynced');
      expect(result).not.toHaveProperty('isRecoveringSession');
    });

    it('does not write the transient error/loading fields', () => {
      const result = written({ isLoading: true, error: 'boom' } as Partial<AuthState>);

      expect(result).not.toHaveProperty('isLoading');
      expect(result).not.toHaveProperty('error');
    });

    it('still writes the durable session fields', () => {
      const result = written({ isUserSynced: true });

      expect(result['isAuthenticated']).toBe(true);
      expect(result['sessionExpiresAt']).toBe('2030-01-01T00:00:00.000Z');
      expect(result['user']).toEqual(baseState.user);
    });
  });

  describe('outbound (what a cold start rehydrates)', () => {
    const rehydrated = (stored: Record<string, unknown>) =>
      authTransform.out(stored as never, KEY, {} as never) as AuthState;

    it('rehydrates the per-run flags as false', () => {
      const result = rehydrated({ ...baseState });

      expect(result.isUserSynced).toBe(false);
      expect(result.isRecoveringSession).toBe(false);
    });

    // The regression itself. Devices upgrading from before this fix still hold
    // `isUserSynced: true` on disk; the read path must neutralise it rather than
    // relying on a PERSIST_VERSION bump to purge it.
    it('forces the flags false even when disk holds a stale true', () => {
      const result = rehydrated({
        ...baseState,
        isUserSynced: true,
        isRecoveringSession: true,
      });

      expect(result.isUserSynced).toBe(false);
      expect(result.isRecoveringSession).toBe(false);
    });

    it('resets isLoading and clears error', () => {
      const result = rehydrated({ ...baseState, isLoading: true, error: 'stale' });

      expect(result.isLoading).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('preserves the restored identity — the offline cold-start path', () => {
      const result = rehydrated({ ...baseState, isUserSynced: true });

      expect(result.user).toEqual(baseState.user);
      expect(result.isAuthenticated).toBe(true);
    });
  });
});
