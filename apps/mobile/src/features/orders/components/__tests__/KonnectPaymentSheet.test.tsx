/**
 * KonnectPaymentSheet — Unit Tests
 *
 * Regression lock for the payment-launch race (Bug A): success (URL opened) and
 * failure (URL could not open) must be mutually exclusive. A launch failure must
 * surface via onPaymentFailed and must NOT trigger onDismiss (which navigates
 * away and would silently swallow the failure).
 */

import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { KonnectPaymentSheet } from '../KonnectPaymentSheet';

jest.mock('@/utils/logger', () => ({
  Logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

const PAY_URL = 'https://konnect.pay/checkout/abc';

describe('KonnectPaymentSheet', () => {
  afterEach(() => jest.restoreAllMocks());

  it('opens the payment URL and dismisses on success — without signalling failure', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as unknown as void);
    const onDismiss = jest.fn();
    const onPaymentFailed = jest.fn();

    render(
      <KonnectPaymentSheet
        visible
        payUrl={PAY_URL}
        onDismiss={onDismiss}
        onPaymentFailed={onPaymentFailed}
      />,
    );

    expect(openURL).toHaveBeenCalledWith(PAY_URL);
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(onPaymentFailed).not.toHaveBeenCalled();
  });

  it('signals failure and does NOT dismiss when the URL cannot be opened (Bug A)', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No handler for URL'));
    const onDismiss = jest.fn();
    const onPaymentFailed = jest.fn();

    render(
      <KonnectPaymentSheet
        visible
        payUrl={PAY_URL}
        onDismiss={onDismiss}
        onPaymentFailed={onPaymentFailed}
      />,
    );

    await waitFor(() => expect(onPaymentFailed).toHaveBeenCalledTimes(1));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does nothing while not visible', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as unknown as void);
    const onDismiss = jest.fn();
    const onPaymentFailed = jest.fn();

    render(
      <KonnectPaymentSheet
        visible={false}
        payUrl={PAY_URL}
        onDismiss={onDismiss}
        onPaymentFailed={onPaymentFailed}
      />,
    );

    expect(openURL).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onPaymentFailed).not.toHaveBeenCalled();
  });

  it('does nothing with an empty payUrl', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as unknown as void);

    render(
      <KonnectPaymentSheet visible payUrl='' onDismiss={jest.fn()} onPaymentFailed={jest.fn()} />,
    );

    expect(openURL).not.toHaveBeenCalled();
  });
});
