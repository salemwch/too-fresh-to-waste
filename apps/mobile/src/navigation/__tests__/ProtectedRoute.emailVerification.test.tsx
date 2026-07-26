/**
 * ProtectedRoute — the email-verification gate.
 *
 * This is the user-visible half of the persisted-isUserSynced fix. The gate is
 *
 *   if (user?.isEmailVerified !== true && isUserSynced) -> show the wall
 *
 * and the `&& isUserSynced` exists so an unconfirmed Keychain copy cannot block
 * someone. While isUserSynced was persisted it rehydrated as `true`, so on cold
 * start the wall was decided from stale data: a user who had verified on another
 * device saw "Email Verification Required" until the sync landed.
 *
 * The first test below is that regression, stated directly.
 */

import { render } from '@testing-library/react-native';
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

import { ProtectedRoute } from '../ProtectedRoute';

const CHILD = 'protected-content';

const state = (over: Record<string, unknown>) => ({
  isAuthenticated: true,
  isLoading: false,
  // Far future, so the refresh/expiry effects stay dormant.
  sessionExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  user: { userId: 'u1', role: 'consumer', isEmailVerified: true },
  isUserSynced: true,
  ...over,
});

const renderRoute = () =>
  render(
    <ProtectedRoute>
      <RNText>{CHILD}</RNText>
    </ProtectedRoute>,
  );

const WALL = 'Email Verification Required';

describe('ProtectedRoute — email verification gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = state({});
  });

  // THE REGRESSION. Cold start, sync has not run yet, and the restored copy says
  // unverified. That copy may simply be out of date, so the wall must not show.
  it('does NOT wall an unverified user before the sync has landed', () => {
    mockAuthState = state({
      user: { userId: 'u1', role: 'consumer', isEmailVerified: false },
      isUserSynced: false,
    });

    const { queryByText, getByText } = renderRoute();

    expect(queryByText(WALL)).toBeNull();
    expect(getByText(CHILD)).toBeTruthy();
  });

  it('walls an unverified user once the server has confirmed it', () => {
    mockAuthState = state({
      user: { userId: 'u1', role: 'consumer', isEmailVerified: false },
      isUserSynced: true,
    });

    const { getByText, queryByText } = renderRoute();

    expect(getByText(WALL)).toBeTruthy();
    expect(queryByText(CHILD)).toBeNull();
  });

  it('renders content for a verified, synced user', () => {
    const { getByText, queryByText } = renderRoute();

    expect(getByText(CHILD)).toBeTruthy();
    expect(queryByText(WALL)).toBeNull();
  });

  it('renders content for a verified user before the sync lands', () => {
    mockAuthState = state({ isUserSynced: false });

    const { getByText, queryByText } = renderRoute();

    expect(getByText(CHILD)).toBeTruthy();
    expect(queryByText(WALL)).toBeNull();
  });

  // Drivers reach protected screens too, and the gate is role-agnostic.
  it('applies the same rule to a DRIVER', () => {
    mockAuthState = state({
      user: { userId: 'd1', role: 'driver', isEmailVerified: false },
      isUserSynced: false,
    });

    const { queryByText, getByText } = renderRoute();

    expect(queryByText(WALL)).toBeNull();
    expect(getByText(CHILD)).toBeTruthy();
  });
});
