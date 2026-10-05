/**
 * ProtectedRoute - session refresh and expiry timers.
 *
 * Pins the behaviour of the two effect-driven routines (token refresh near
 * expiry, logout at expiry) so the move from the hand-written "latest ref"
 * pattern to React 19.2's useEffectEvent can be proven behaviour-preserving:
 *
 *  - the refresh check runs on mount and whenever isAuthenticated /
 *    sessionExpiresAt change, and once a minute from ONE interval;
 *  - the interval always reads the LATEST auth state, never the state captured
 *    when it was created;
 *  - logout fires when the session expires, immediately if already expired;
 *  - nothing keeps running after unmount.
 */
import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Text as RNText } from 'react-native';

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Text: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.Text, null, children as React.ReactNode),
  };
});

jest.mock('@/design-system/providers', () => ({
  useTheme: () => ({ colors: { background: '#fff', primary: '#1E4448' } }),
}));

jest.mock('@/features/auth/store/authSlice', () => ({
  logoutAsync: jest.fn(() => ({ type: 'auth/logout' })),
}));

jest.mock('@/services/authRefresh', () => ({
  refreshTokenSafe: jest.fn(async () => ({ success: true })),
}));

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

let mockAuthState: Record<string, unknown> = {};
jest.mock('@/hooks/redux', () => ({
  useAppSelector: (fn: (s: unknown) => unknown) => fn({ auth: mockAuthState }),
  useAppDispatch: () => jest.fn(() => ({ finally: (cb: () => void) => cb() })),
}));

import { logoutAsync } from '@/features/auth/store/authSlice';
import { refreshTokenSafe } from '@/services/authRefresh';

import { ProtectedRoute } from '../ProtectedRoute';

const MINUTE = 60_000;
const expiresIn = (ms: number) => new Date(Date.now() + ms).toISOString();

const state = (over: Record<string, unknown>) => ({
  isAuthenticated: true,
  isLoading: false,
  sessionExpiresAt: expiresIn(24 * 60 * MINUTE),
  user: { userId: 'u1', role: 'consumer', isEmailVerified: true },
  isUserSynced: true,
  ...over,
});

const ui = () => (
  <ProtectedRoute>
    <RNText>content</RNText>
  </ProtectedRoute>
);

const refreshCalls = () => (refreshTokenSafe as jest.Mock).mock.calls.length;
const logoutCalls = () => (logoutAsync as unknown as jest.Mock).mock.calls.length;

describe('ProtectedRoute - session timers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes on mount when the session expires within five minutes', () => {
    mockAuthState = state({ sessionExpiresAt: expiresIn(2 * MINUTE) });
    render(ui());
    expect(refreshCalls()).toBe(1);
  });

  it('does not refresh on mount when the session is far from expiry', () => {
    mockAuthState = state({});
    render(ui());
    expect(refreshCalls()).toBe(0);
  });

  it('re-checks when sessionExpiresAt changes', () => {
    mockAuthState = state({});
    const view = render(ui());
    expect(refreshCalls()).toBe(0);

    mockAuthState = state({ sessionExpiresAt: expiresIn(3 * MINUTE) });
    view.rerender(ui());
    expect(refreshCalls()).toBe(1);
  });

  it('runs the minute check from exactly one interval across re-renders', () => {
    mockAuthState = state({ sessionExpiresAt: expiresIn(2 * MINUTE) });
    const view = render(ui());
    view.rerender(ui());
    view.rerender(ui());
    const afterMount = refreshCalls();

    act(() => {
      jest.advanceTimersByTime(MINUTE);
    });
    // One tick, one interval: a duplicated interval would add more than one.
    expect(refreshCalls()).toBe(afterMount + 1);
  });

  it('the interval reads the latest auth state, not the state it was created with', () => {
    mockAuthState = state({ sessionExpiresAt: expiresIn(2 * MINUTE) });
    const view = render(ui());
    const afterMount = refreshCalls();

    // Same props, new store state: signed out. The interval was created while
    // signed in; it must now see isAuthenticated=false and skip the refresh.
    mockAuthState = state({ isAuthenticated: false, sessionExpiresAt: expiresIn(2 * MINUTE) });
    view.rerender(ui());
    act(() => {
      jest.advanceTimersByTime(MINUTE);
    });
    expect(refreshCalls()).toBe(afterMount);
  });

  it('logs out immediately when the session has already expired', () => {
    mockAuthState = state({ sessionExpiresAt: expiresIn(-1000) });
    render(ui());
    expect(logoutCalls()).toBe(1);
  });

  it('logs out when the session expires while mounted', () => {
    mockAuthState = state({ sessionExpiresAt: expiresIn(10 * MINUTE) });
    render(ui());
    expect(logoutCalls()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(10 * MINUTE);
    });
    expect(logoutCalls()).toBe(1);
  });

  it('does nothing for a signed-out user', () => {
    mockAuthState = state({ isAuthenticated: false, sessionExpiresAt: expiresIn(-1000) });
    render(ui());
    act(() => {
      jest.advanceTimersByTime(5 * MINUTE);
    });
    expect(refreshCalls()).toBe(0);
    expect(logoutCalls()).toBe(0);
  });

  it('stops every timer on unmount', () => {
    mockAuthState = state({ sessionExpiresAt: expiresIn(2 * MINUTE) });
    const view = render(ui());
    const afterMount = refreshCalls();
    view.unmount();

    act(() => {
      jest.advanceTimersByTime(10 * MINUTE);
    });
    expect(refreshCalls()).toBe(afterMount);
    expect(logoutCalls()).toBe(0);
  });
});
