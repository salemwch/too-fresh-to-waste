/**
 * LoginScreen, after a failed sign-in - rendered, submitted, and the screen's
 * own reaction asserted.
 *
 * loginFailure.test.ts proves the decision; this proves the screen acts on it.
 * The bug this exists for lived in the screen: it gated the locked-account
 * modal on `isAppError`, which is false for every thunk rejection, so the
 * countdown never opened. A test of the decision alone passes with that gate
 * put back.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/design-system/providers';

import { LoginScreen } from '../LoginScreen';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  statusCodes: {},
  GoogleSigninButton: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), addListener: () => () => {} }),
  useFocusEffect: () => undefined,
  useRoute: () => ({ params: {} }),
}));

/** What `loginAsync(...).unwrap()` rejects with, set per test. */
let mockRejection: unknown;

jest.mock('react-redux', () => {
  const useSelector = (selector: (s: unknown) => unknown) =>
    selector({ auth: { user: null, isAuthenticated: false, isLoading: false, error: null } });
  // Thunks (functions) resolve to an object with unwrap; plain actions pass through.
  const dispatch = (action: unknown) =>
    typeof action === 'function' ? { unwrap: () => Promise.reject(mockRejection) } : action;
  const useDispatch = () => dispatch;
  useSelector.withTypes = () => useSelector;
  useDispatch.withTypes = () => useDispatch;
  return { useDispatch, useSelector };
});

async function submitLogin() {
  render(
    <ThemeProvider defaultTheme='light'>
      <LoginScreen
        {...({ navigation: { navigate: jest.fn() } } as unknown as React.ComponentProps<
          typeof LoginScreen
        >)}
      />
    </ThemeProvider>,
  );
  fireEvent.changeText(screen.getByTestId('login-email-input'), 'a@b.com');
  fireEvent.changeText(screen.getByTestId('login-password-input'), 'Abcdefghij1!');
  await act(async () => {
    fireEvent.press(screen.getByTestId('login-submit-button'));
  });
}

const BLOCKED_UNTIL = new Date(Date.now() + 15 * 60_000).toISOString();

describe('LoginScreen after a failed sign-in', () => {
  it('opens the locked-account modal for LOGIN_TEMPORARILY_BLOCKED', async () => {
    mockRejection = {
      message: 'Trop de tentatives de connexion.',
      type: 'LOGIN_TEMPORARILY_BLOCKED',
      isAccountLocked: true,
      blockedUntil: BLOCKED_UNTIL,
    };

    await submitLogin();

    // The modal is the only place a countdown can render.
    await waitFor(() => expect(screen.queryByTestId('account-locked-modal')).toBeTruthy());
  });

  it('does not open it for INVALID_CREDENTIALS', async () => {
    mockRejection = { message: 'The email or password is incorrect.', type: 'INVALID_CREDENTIALS' };

    await submitLogin();

    expect(screen.queryByTestId('account-locked-modal')).toBeNull();
  });
});
