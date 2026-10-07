/**
 * GoogleSignInButton - the "Continue with Google" button on Login and Register.
 *
 * WHAT THIS PROTECTS
 * ------------------
 *   1. **The label is translated text.** It used to be Google's prebuilt
 *      artwork, where "Continue with Google" is an outlined SVG path, so French
 *      and Arabic users saw English (MOBILE_LIGHT_DEVICE_VERIFICATION_REPORT.md
 *      DL-4). A regression back to artwork renders fine in English and in a
 *      snapshot, so only an assertion on the fr and ar text catches it.
 *   2. **Google's branding values** (DESIGN.md §19-E35) - in both app themes,
 *      because the button is light-only by decision.
 *   3. **Every sign-in outcome**: success, cancel, in-progress, no Play
 *      Services, no id token, an SDK error, and a backend rejection - the last
 *      of which must stay silent here because the screen shows `auth.error`.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18next from 'i18next';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';

import { ThemeProvider } from '@/design-system/providers';
import { googleSignInButtonColors } from '@/design-system/tokens/colors';
import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import { showSuccessToast } from '@/utils/toast';

import { googleSignInAsync } from '../../store/authSlice';
import { GoogleSignInButton } from '../GoogleSignInButton';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { hasPlayServices: jest.fn(), signIn: jest.fn(), signOut: jest.fn() },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/utils/toast', () => ({ showSuccessToast: jest.fn() }));
jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
// The real thunk pulls in the auth service, Keychain and the API client; the
// button only needs its action creator and an unwrap() that settles.
jest.mock('../../store/authSlice', () => ({
  googleSignInAsync: jest.fn((arg: unknown) => ({ type: 'auth/googleSignIn', meta: { arg } })),
}));
const mockUnwrap = jest.fn();
const mockDispatch = jest.fn(() => ({ unwrap: mockUnwrap }));
jest.mock('@/hooks/redux', () => ({ useAppDispatch: () => mockDispatch }));

const mockSignIn = GoogleSignin.signIn as jest.Mock;
const mockSignOut = GoogleSignin.signOut as jest.Mock;
const mockHasPlayServices = GoogleSignin.hasPlayServices as jest.Mock;
const mockGoogleSignInAsync = googleSignInAsync as unknown as jest.Mock;

const LABELS = {
  en: en.auth.continueWithGoogle,
  fr: fr.auth.continueWithGoogle,
  ar: ar.auth.continueWithGoogle,
} as const;

const renderButton = (
  props: React.ComponentProps<typeof GoogleSignInButton> = {},
  theme: 'light' | 'dark' = 'light',
) =>
  render(
    <ThemeProvider defaultTheme={theme}>
      <GoogleSignInButton {...props} />
    </ThemeProvider>,
  );

const pressButton = (): void => {
  fireEvent.press(screen.getByRole('button'));
};

/** An SDK failure as the Google Sign-In module throws it. */
const sdkError = (code: string): Error => Object.assign(new Error(`google: ${code}`), { code });

beforeAll(() => {
  // jest.setup.js only loads English; fr and ar are added here so the
  // localisation assertions run against the real locale files.
  i18next.addResourceBundle('fr', 'translation', fr, true, true);
  i18next.addResourceBundle('ar', 'translation', ar, true, true);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPlayServices.mockResolvedValue(true);
  mockSignOut.mockResolvedValue(null);
  mockUnwrap.mockResolvedValue({});
});

afterEach(async () => {
  await i18next.changeLanguage('en');
});

describe('GoogleSignInButton', () => {
  // ==========================================================================
  // Label and branding
  // ==========================================================================

  describe.each(Object.entries(LABELS))('in %s', (locale, label) => {
    it('renders the label as translated text', async () => {
      await i18next.changeLanguage(locale);
      renderButton();

      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByRole('button').props['accessibilityLabel']).toBe(label);
    });
  });

  it('actually differs per locale, so the locale assertions are not vacuous', () => {
    expect(new Set(Object.values(LABELS)).size).toBe(3);
  });

  it('renders the Google "G" as its only image, beside the label', () => {
    renderButton();

    // One SVG (the logo). The old artwork was also one SVG, but with no
    // text node - the label assertion above is what tells them apart.
    expect(screen.getAllByTestId('svg-icon')).toHaveLength(1);
  });

  it.each(['light', 'dark'] as const)(
    'uses Google light-theme branding in the %s app theme',
    theme => {
      renderButton({}, theme);

      const button = StyleSheet.flatten(screen.getByRole('button').props['style']);
      const label = StyleSheet.flatten(screen.getByText(LABELS.en).props['style']);

      expect(button.backgroundColor).toBe(googleSignInButtonColors.surface);
      expect(button.borderColor).toBe(googleSignInButtonColors.border);
      expect(button.borderWidth).toBe(1);
      expect(label.color).toBe(googleSignInButtonColors.label);
      expect(label.fontSize).toBe(14);
      expect(label.lineHeight).toBe(20);
    },
  );

  it('grows with a scaled font instead of clipping the label', () => {
    renderButton();

    const button = StyleSheet.flatten(screen.getByRole('button').props['style']);
    const label = StyleSheet.flatten(screen.getByText(LABELS.en).props['style']);

    expect(button.height).toBeUndefined();
    expect(button.minHeight).toBe(56);
    expect(label.flexShrink).toBe(1);
  });

  // ==========================================================================
  // Sign-in outcomes
  // ==========================================================================

  it('signs in with the id token and welcomes the user', async () => {
    mockSignIn.mockResolvedValue({ data: { idToken: 'id-token' } });
    renderButton();

    pressButton();

    await waitFor(() => {
      expect(showSuccessToast).toHaveBeenCalledWith(en.auth.welcomeMessage);
    });
    expect(mockGoogleSignInAsync).toHaveBeenCalledWith({ idToken: 'id-token' });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(en.auth.googleSignInFailed)).toBeNull();
  });

  it('passes the referral code through when there is one', async () => {
    mockSignIn.mockResolvedValue({ data: { idToken: 'id-token' } });
    renderButton({ referralCode: 'FRIEND10' });

    pressButton();

    await waitFor(() => {
      expect(mockGoogleSignInAsync).toHaveBeenCalledWith({
        idToken: 'id-token',
        referralCode: 'FRIEND10',
      });
    });
  });

  it('reports missing credentials when Google returns no id token', async () => {
    mockSignIn.mockResolvedValue({ data: { idToken: null } });
    renderButton();

    pressButton();

    expect(await screen.findByText(en.auth.googleCredentialsFailed)).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it.each(['SIGN_IN_CANCELLED', 'IN_PROGRESS'])(
    'stays silent when the SDK reports %s, and signs out of Google',
    async code => {
      mockSignIn.mockRejectedValue(sdkError(code));
      renderButton();

      pressButton();

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText(en.auth.googleSignInFailed)).toBeNull();
      expect(Sentry.captureException).not.toHaveBeenCalled();
    },
  );

  it('explains when Play Services is unavailable', async () => {
    mockHasPlayServices.mockRejectedValue(sdkError('PLAY_SERVICES_NOT_AVAILABLE'));
    renderButton();

    pressButton();

    expect(await screen.findByText(en.auth.googlePlayUnavailable)).toBeTruthy();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('shows a generic failure and reports any other SDK error', async () => {
    mockSignIn.mockRejectedValue(sdkError('DEVELOPER_ERROR'));
    renderButton();

    pressButton();

    expect(await screen.findByText(en.auth.googleSignInFailed)).toBeTruthy();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('leaves a backend rejection to the screen, which shows auth.error', async () => {
    mockSignIn.mockResolvedValue({ data: { idToken: 'id-token' } });
    // A rejected thunk unwraps to its payload: a message key, no SDK code.
    mockUnwrap.mockRejectedValue({ message: 'auth.errorAccountSuspended' });
    renderButton();

    pressButton();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(en.auth.googleSignInFailed)).toBeNull();
    expect(showSuccessToast).not.toHaveBeenCalled();
  });

  it('ignores a second tap while a sign-in is running', async () => {
    let resolveSignIn: (value: unknown) => void = () => undefined;
    mockSignIn.mockReturnValue(
      new Promise(resolve => {
        resolveSignIn = resolve;
      }),
    );
    renderButton();

    pressButton();
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });
    pressButton();
    resolveSignIn({ data: { idToken: 'id-token' } });

    await waitFor(() => {
      expect(showSuccessToast).toHaveBeenCalledTimes(1);
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });
});
