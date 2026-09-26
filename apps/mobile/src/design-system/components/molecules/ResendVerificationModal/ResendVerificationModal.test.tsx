/**
 * ResendVerificationModal Component Tests
 *
 * Previously uncovered. This modal is the recovery path for a user whose
 * verification link expired, so its failure modes are user-facing: a rejected
 * send must surface a readable message rather than a silent no-op, and the
 * modal must not be dismissable mid-request (which would strand the caller's
 * loading state).
 */

import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import en from '../../../../i18n/locales/en.json';
import { ThemeProvider } from '../../../providers';

import { ResendVerificationModal } from './ResendVerificationModal';

const VALID_EMAIL = 'user@example.com';

const setup = (props: Partial<React.ComponentProps<typeof ResendVerificationModal>> = {}) => {
  const onDismiss = jest.fn();
  const onSuccess = jest.fn();
  const onSendVerification = jest.fn().mockResolvedValue(undefined);

  const utils = render(
    <ThemeProvider>
      <ResendVerificationModal
        visible
        onDismiss={onDismiss}
        onSuccess={onSuccess}
        onSendVerification={onSendVerification}
        {...props}
      />
    </ThemeProvider>,
  );

  return { ...utils, onDismiss, onSuccess, onSendVerification };
};

const emailField = () => screen.getByPlaceholderText('Enter your email');
const sendButton = () => screen.getByText(en.auth.resend.send);

describe('ResendVerificationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders nothing when not visible', () => {
      setup({ visible: false });
      expect(screen.queryByText('Verify Your Email')).toBeNull();
    });

    it('renders the form when visible', () => {
      setup();
      expect(screen.getByText('Verify Your Email')).toBeTruthy();
      expect(emailField()).toBeTruthy();
    });
  });

  describe('Submitting', () => {
    it('sends the entered email', async () => {
      const { onSendVerification } = setup();

      fireEvent.changeText(emailField(), VALID_EMAIL);
      fireEvent.press(sendButton());

      await waitFor(() => expect(onSendVerification).toHaveBeenCalledWith(VALID_EMAIL));
    });

    it('reports success to the caller with the email', async () => {
      const { onSuccess } = setup();

      fireEvent.changeText(emailField(), VALID_EMAIL);
      fireEvent.press(sendButton());

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(VALID_EMAIL));
    });

    it('normalises a mixed-case, padded address before sending', async () => {
      const { onSendVerification } = setup();

      // The yup schema trims and lowercases; the backend lookup is case-sensitive.
      fireEvent.changeText(emailField(), '  User@Example.COM  ');
      fireEvent.press(sendButton());

      await waitFor(() => expect(onSendVerification).toHaveBeenCalledWith(VALID_EMAIL));
    });

    it('does not send when the field is empty', async () => {
      const { onSendVerification, onSuccess } = setup();

      fireEvent.press(sendButton());

      await waitFor(() => expect(screen.getByText('Email is required')).toBeTruthy());
      expect(onSendVerification).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('does not send a malformed address', async () => {
      const { onSendVerification } = setup();

      fireEvent.changeText(emailField(), 'not-an-email');
      fireEvent.press(sendButton());

      await waitFor(() =>
        expect(screen.getByText('Please enter a valid email address')).toBeTruthy(),
      );
      expect(onSendVerification).not.toHaveBeenCalled();
    });
  });

  describe('Failure handling', () => {
    it('shows the failure reason and does not report success', async () => {
      const onSendVerification = jest.fn().mockRejectedValue(new Error('Too many requests'));
      const { onSuccess } = setup({ onSendVerification });

      fireEvent.changeText(emailField(), VALID_EMAIL);
      fireEvent.press(sendButton());

      await waitFor(() => expect(screen.getByText('Too many requests')).toBeTruthy());
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('falls back to a readable message when the rejection is not an Error', async () => {
      // Axios/network layers can reject with a non-Error; a raw object must never
      // reach the user as "[object Object]".
      const onSendVerification = jest.fn().mockRejectedValue({ status: 500 });
      setup({ onSendVerification });

      fireEvent.changeText(emailField(), VALID_EMAIL);
      fireEvent.press(sendButton());

      await waitFor(() => expect(screen.getByText(en.verifyEmail.failedToResend)).toBeTruthy());
    });

    it('allows retrying after a failure', async () => {
      const onSendVerification = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);
      const { onSuccess } = setup({ onSendVerification });

      fireEvent.changeText(emailField(), VALID_EMAIL);
      fireEvent.press(sendButton());
      await waitFor(() => expect(screen.getByText('Network error')).toBeTruthy());

      fireEvent.press(sendButton());

      // The loading flag must have been released in `finally`, or this second
      // press is swallowed by the disabled button.
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(VALID_EMAIL));
      expect(onSendVerification).toHaveBeenCalledTimes(2);
    });
  });

  describe('Dismissing', () => {
    it('dismisses when cancelled', () => {
      const { onDismiss } = setup();

      fireEvent.press(screen.getByText('Cancel'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
