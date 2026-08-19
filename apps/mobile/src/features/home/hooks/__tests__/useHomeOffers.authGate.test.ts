/**
 * useHomeOffers — no /offers request may leave before auth is settled.
 *
 * Every query in this hook hits `/offers/*`, which sits behind `JwtAuthGuard`.
 * PRIORITY 1 used to run with `enabled: true` and PRIORITY 2-4 on a bare 500 ms
 * timer, so on a cold start or an app resume they fired while session recovery
 * was still in flight. The request interceptor then found no access token in
 * the Keychain, sent the request anyway, and the backend answered 401 "Invalid
 * or expired token".
 *
 * That 401 was not harmless. The response interceptor treats any non-network
 * refresh failure as fatal, and a refresh racing recovery looks exactly like
 * one — so it ran `forceLocalLogout()` and `SecureStorage.clearAll()` and
 * signed out a user whose session was valid. In production on build 80 this was
 * REACT-NATIVE-13/12/14: 95 events across the same 6 users.
 *
 * These tests assert the `enabled` flag each query receives, because that is
 * the seam that was wrong. Asserting "the hook returns data" would have passed
 * against the broken version — the requests still resolved, after the logout.
 */

import { act, renderHook } from '@testing-library/react-native';

import { HOME_UI_CONFIG } from '../../constants/homeConstants';

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Captures the options object each query hook is called with. */
const mockEnabledFor: Record<string, boolean | undefined> = {};

const mockCaptureEnabled =
  (section: string) =>
  (...args: unknown[]) => {
    const options = args[args.length - 1] as { enabled?: boolean } | undefined;
    mockEnabledFor[section] = options?.enabled;
    return { data: undefined, isLoading: false, error: null, refetch: jest.fn() };
  };

jest.mock('@/features/offers/hooks/useOffers', () => ({
  useUrgentOffers: jest.fn((...args: unknown[]) => mockCaptureEnabled('urgent')(...args)),
  useOffers: jest.fn((...args: unknown[]) => mockCaptureEnabled('hottest')(...args)),
  usePickupTodayOffers: jest.fn((...args: unknown[]) => mockCaptureEnabled('pickupToday')(...args)),
  usePickupTomorrowOffers: jest.fn((...args: unknown[]) =>
    mockCaptureEnabled('pickupTomorrow')(...args),
  ),
}));

/** Auth slice shape the readiness predicate reads. Mutated per test. */
let mockAuthState = {
  isAuthenticated: true,
  sessionExpiresAt: null as string | null,
  isRecoveringSession: false,
};

jest.mock('@/hooks/redux', () => ({
  useAppSelector: (selector: (state: { auth: typeof mockAuthState }) => unknown) =>
    selector({ auth: mockAuthState }),
}));

import { useHomeOffers } from '../useHomeOffers';

const SECTIONS = ['urgent', 'hottest', 'pickupToday', 'pickupTomorrow'] as const;
const SECONDARY = ['hottest', 'pickupToday', 'pickupTomorrow'] as const;

/**
 * The rendered hook, tracked so it can be unmounted.
 *
 * Not optional hygiene: `useHomeOffers` arms a `setTimeout` for the lazy-load
 * delay and clears it in its effect cleanup. Leaving the hook mounted leaves
 * that timer pending, and a pending fake timer at the point the suite switches
 * back to real timers is an open handle that keeps the whole Jest run alive —
 * it failed two unrelated suites before this was added.
 */
let rendered: ReturnType<typeof renderHook<ReturnType<typeof useHomeOffers>, unknown>> | undefined;

const setup = () => {
  rendered = renderHook(() => useHomeOffers(undefined, {}));
  return rendered;
};

/** Advances past the lazy-load timer so PRIORITY 2-4 are no longer time-gated. */
const elapseLazyLoadDelay = () => {
  act(() => {
    jest.advanceTimersByTime(HOME_UI_CONFIG.LAZY_LOAD_DELAY_MS + 1);
  });
};

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('useHomeOffers — auth gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    for (const key of Object.keys(mockEnabledFor)) delete mockEnabledFor[key];
    mockAuthState = { isAuthenticated: true, sessionExpiresAt: null, isRecoveringSession: false };
  });

  afterEach(() => {
    // Order matters: unmount first so the hook's effect cleanup clears its
    // pending timeout, then drain anything still queued, and only then hand
    // the timers back. Reversing any of these leaves a live handle behind.
    rendered?.unmount();
    rendered = undefined;
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe('auth states that must send nothing', () => {
    it('sends nothing while session recovery is in flight', () => {
      // The production bug. A valid session, mid-recovery — the old code fired
      // PRIORITY 1 here, got a 401, and the interceptor wiped the Keychain.
      mockAuthState = { isAuthenticated: true, sessionExpiresAt: null, isRecoveringSession: true };

      setup();
      elapseLazyLoadDelay();

      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(false);
      }
    });

    it('sends nothing when the user is not authenticated', () => {
      mockAuthState = {
        isAuthenticated: false,
        sessionExpiresAt: null,
        isRecoveringSession: false,
      };

      setup();
      elapseLazyLoadDelay();

      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(false);
      }
    });

    it('sends nothing when the local session has already expired', () => {
      mockAuthState = {
        isAuthenticated: true,
        sessionExpiresAt: anHourAgo(),
        isRecoveringSession: false,
      };

      setup();
      elapseLazyLoadDelay();

      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(false);
      }
    });

    it('prefers the recovering reason over expiry when both hold', () => {
      // Mid-recovery the stored expiry is usually stale, so both conditions
      // fire at once. Either way nothing may be sent.
      mockAuthState = {
        isAuthenticated: true,
        sessionExpiresAt: anHourAgo(),
        isRecoveringSession: true,
      };

      setup();

      expect(mockEnabledFor['urgent']).toBe(false);
    });
  });

  describe('auth settled', () => {
    it('enables PRIORITY 1 immediately and holds PRIORITY 2-4 for the timer', () => {
      setup();

      expect(mockEnabledFor['urgent']).toBe(true);
      for (const section of SECONDARY) {
        expect(mockEnabledFor[section]).toBe(false);
      }
    });

    it('enables all four once the lazy-load delay has elapsed', () => {
      setup();
      elapseLazyLoadDelay();

      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(true);
      }
    });

    it('treats an expiry inside the clock-skew tolerance as still valid', () => {
      mockAuthState = {
        isAuthenticated: true,
        sessionExpiresAt: inOneHour(),
        isRecoveringSession: false,
      };

      setup();

      expect(mockEnabledFor['urgent']).toBe(true);
    });

    it('accepts a null expiry, which is how a fresh cold start looks', () => {
      setup();

      expect(mockEnabledFor['urgent']).toBe(true);
    });
  });

  describe('the timer alone is never sufficient', () => {
    it('keeps PRIORITY 2-4 disabled when the delay elapses before auth settles', () => {
      // The second half of the bug: the secondary queries were gated only on a
      // 500 ms timer. Recovery routinely outlasts it, so they fired too.
      mockAuthState = { isAuthenticated: true, sessionExpiresAt: null, isRecoveringSession: true };

      setup();
      elapseLazyLoadDelay();

      for (const section of SECONDARY) {
        expect(mockEnabledFor[section]).toBe(false);
      }
    });
  });

  describe('transitions', () => {
    it('starts sending only after recovery finishes', () => {
      mockAuthState = { isAuthenticated: true, sessionExpiresAt: null, isRecoveringSession: true };

      const { rerender } = setup();
      expect(mockEnabledFor['urgent']).toBe(false);

      // Recovery completes — middleware clears the flag.
      mockAuthState = { ...mockAuthState, isRecoveringSession: false };
      act(() => {
        rerender({});
      });

      expect(mockEnabledFor['urgent']).toBe(true);
    });

    it('stops sending when the app resumes and recovery restarts', () => {
      const { rerender } = setup();
      elapseLazyLoadDelay();
      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(true);
      }

      // Resume: middleware raises the flag again before refreshing.
      mockAuthState = { ...mockAuthState, isRecoveringSession: true };
      act(() => {
        rerender({});
      });

      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(false);
      }
    });

    it('stops sending the moment the session is cleared by a logout', () => {
      const { rerender } = setup();
      elapseLazyLoadDelay();
      expect(mockEnabledFor['urgent']).toBe(true);

      mockAuthState = {
        isAuthenticated: false,
        sessionExpiresAt: null,
        isRecoveringSession: false,
      };
      act(() => {
        rerender({});
      });

      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(false);
      }
    });

    it('survives the full cold-start sequence without ever enabling early', () => {
      // The exact production path: mount mid-recovery, the lazy timer expires
      // while still recovering, then recovery completes.
      mockAuthState = { isAuthenticated: true, sessionExpiresAt: null, isRecoveringSession: true };
      const { rerender } = setup();

      expect(mockEnabledFor['urgent']).toBe(false);

      elapseLazyLoadDelay();
      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(false);
      }

      mockAuthState = { ...mockAuthState, isRecoveringSession: false };
      act(() => {
        rerender({});
      });

      // Only now — and all four at once, since the timer already elapsed.
      for (const section of SECTIONS) {
        expect(mockEnabledFor[section]).toBe(true);
      }
    });
  });
});
