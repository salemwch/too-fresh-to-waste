/**
 * VerifyPhoneScreen Tests
 *
 * Previously uncovered. Focuses on the paths a real user hits: the code being
 * sent automatically on arrival, the Android SMS-autofill listener (including
 * its failure and cleanup branches, which are silent when broken), and the
 * guards around a missing phone number or expired session.
 */

import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/utils/logger', () => ({
  Logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
  showSuccessAlert: jest.fn(),
  showErrorAlert: jest.fn(),
}));

jest.mock('react-native-sms-retriever', () => ({
  __esModule: true,
  default: {
    startSmsRetriever: jest.fn().mockResolvedValue(true),
    addSmsListener: jest.fn().mockResolvedValue(undefined),
    removeSmsListener: jest.fn(),
  },
}));

const mockSendPhoneVerification = jest.fn();
const mockConfirmPhoneVerification = jest.fn();

jest.mock('../../services/authService', () => ({
  authService: {
    sendPhoneVerification: (...args: unknown[]) => mockSendPhoneVerification(...args),
    confirmPhoneVerification: (...args: unknown[]) => mockConfirmPhoneVerification(...args),
  },
}));

const mockUseAuth = jest.fn();
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

import SmsRetriever from 'react-native-sms-retriever';

import { showErrorAlert } from '@/utils/alert';
import { ThemeProvider } from '@/design-system/providers';

import { VerifyPhoneScreen } from '../VerifyPhoneScreen';

const PHONE = '+21620123456';
const ACCESS_TOKEN = 'access-token';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn() };

const renderScreen = (routeParams: Record<string, unknown> | undefined = { phoneNumber: PHONE }) =>
  render(
    <ThemeProvider>
      <VerifyPhoneScreen
        // The screen only reads `navigate`; the full navigation prop is large and
        // irrelevant to these behaviours.
        navigation={navigation as never}
        route={{ params: routeParams } as never}
      />
    </ThemeProvider>,
  );

describe('VerifyPhoneScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // SMS Retriever is an Android-only API and the screen guards on it. The RN
    // Jest preset reports 'ios', so without this the autofill effect never runs
    // and every assertion below would pass vacuously.
    jest.replaceProperty(Platform, 'OS', 'android');
    mockUseAuth.mockReturnValue({ tokens: { accessToken: ACCESS_TOKEN } });
    mockSendPhoneVerification.mockResolvedValue({ attemptsRemaining: 3 });
    (SmsRetriever.startSmsRetriever as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Sending the code on arrival', () => {
    it('sends a code automatically when arriving with a phone number', async () => {
      renderScreen();

      await waitFor(() =>
        expect(mockSendPhoneVerification).toHaveBeenCalledWith(
          { phoneNumber: PHONE, method: 'sms' },
          ACCESS_TOKEN,
        ),
      );
    });

    it('sends the code exactly once, not on every re-render', async () => {
      renderScreen();

      await waitFor(() => expect(mockSendPhoneVerification).toHaveBeenCalledTimes(1));

      // The auto-send effect re-runs on its dependencies; hasCodeBeenSent must
      // latch it, or the user is charged for repeated SMS.
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockSendPhoneVerification).toHaveBeenCalledTimes(1);
    });

    it('does not send anything when arriving without a phone number', async () => {
      renderScreen({});

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockSendPhoneVerification).not.toHaveBeenCalled();
    });

    it('survives arriving with no route params at all', async () => {
      // Rendered inline rather than via renderScreen(): passing `undefined` to a
      // parameter with a default would silently fall back to the phone number and
      // make this assertion test the opposite of what it claims.
      render(
        <ThemeProvider>
          <VerifyPhoneScreen navigation={navigation as never} route={{} as never} />
        </ThemeProvider>,
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockSendPhoneVerification).not.toHaveBeenCalled();
      expect(screen.toJSON()).toBeTruthy();
    });

    it('does not send when the session has no access token', async () => {
      mockUseAuth.mockReturnValue({ tokens: null });

      renderScreen();

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockSendPhoneVerification).not.toHaveBeenCalled();
    });
  });

  describe('Send failures', () => {
    it('surfaces a readable message when sending fails', async () => {
      mockSendPhoneVerification.mockRejectedValue(new Error('Carrier rejected the number'));

      renderScreen();

      await waitFor(() =>
        expect(showErrorAlert).toHaveBeenCalledWith(
          'Failed to Send Code',
          expect.stringContaining('Carrier rejected the number'),
        ),
      );
    });

    it('does not leave a technical object in the alert when the rejection is not an Error', async () => {
      mockSendPhoneVerification.mockRejectedValue({ status: 500 });

      renderScreen();

      await waitFor(() => expect(showErrorAlert).toHaveBeenCalled());
      const [, message] = (showErrorAlert as jest.Mock).mock.calls[0] as [string, string];
      expect(message).not.toContain('[object Object]');
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('SMS autofill', () => {
    it('starts the SMS retriever once a code has been sent', async () => {
      renderScreen();

      await waitFor(() => expect(SmsRetriever.startSmsRetriever).toHaveBeenCalled());
      await waitFor(() => expect(SmsRetriever.addSmsListener).toHaveBeenCalled());
    });

    it('does not start the retriever before a code has been sent', async () => {
      mockUseAuth.mockReturnValue({ tokens: null });

      renderScreen();

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(SmsRetriever.startSmsRetriever).not.toHaveBeenCalled();
    });

    it('keeps working when the retriever cannot start', async () => {
      // Some devices/ROMs reject the SMS Retriever API; the user must still be
      // able to type the code, so this must degrade rather than throw.
      (SmsRetriever.startSmsRetriever as jest.Mock).mockRejectedValue(
        new Error('retriever unavailable'),
      );

      renderScreen();

      await waitFor(() => expect(SmsRetriever.startSmsRetriever).toHaveBeenCalled());
      expect(SmsRetriever.addSmsListener).not.toHaveBeenCalled();
      expect(screen.toJSON()).toBeTruthy();
    });

    it('does not register a listener when the retriever reports failure', async () => {
      (SmsRetriever.startSmsRetriever as jest.Mock).mockResolvedValue(false);

      renderScreen();

      await waitFor(() => expect(SmsRetriever.startSmsRetriever).toHaveBeenCalled());
      expect(SmsRetriever.addSmsListener).not.toHaveBeenCalled();
    });

    it('removes the SMS listener on unmount', async () => {
      const { unmount } = renderScreen();

      await waitFor(() => expect(SmsRetriever.addSmsListener).toHaveBeenCalled());
      (SmsRetriever.removeSmsListener as jest.Mock).mockClear();

      unmount();

      // A leaked listener keeps holding the screen's setState after teardown.
      expect(SmsRetriever.removeSmsListener).toHaveBeenCalled();
    });

    it('does not throw when listener cleanup itself fails', async () => {
      const { unmount } = renderScreen();
      await waitFor(() => expect(SmsRetriever.addSmsListener).toHaveBeenCalled());

      (SmsRetriever.removeSmsListener as jest.Mock).mockImplementation(() => {
        throw new Error('already removed');
      });

      expect(() => unmount()).not.toThrow();
    });
  });
});
