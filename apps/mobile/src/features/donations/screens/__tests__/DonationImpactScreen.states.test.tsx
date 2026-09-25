/**
 * DonationImpactScreen - the states before there is data.
 *
 * A failed stats request used to fall into the loading branch (`!stats` is true
 * on error too) and spin forever with no way out. It now shows an error with a
 * retry, and the loading state stays for the real wait.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import en from '../../../../i18n/locales/en.json';
import { ThemeProvider } from '../../../../design-system/providers';
import { DonationImpactScreen } from '../DonationImpactScreen';

const mockState: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
} = { data: undefined, isLoading: false, isError: false, refetch: jest.fn() };

jest.mock('../../hooks/useDonations', () => ({
  useDonationStats: () => mockState,
}));

const renderScreen = () =>
  render(
    <ThemeProvider>
      <DonationImpactScreen />
    </ThemeProvider>,
  );

describe('DonationImpactScreen states', () => {
  beforeEach(() => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    mockState.refetch = jest.fn().mockResolvedValue(undefined);
  });

  it('shows the loading state while the first request is in flight', () => {
    mockState.isLoading = true;

    renderScreen();

    expect(screen.getByText(en.donations.loadingImpact)).toBeTruthy();
    expect(screen.queryByText(en.donations.loadFailed)).toBeNull();
  });

  it('shows an error, not an endless spinner, when the request fails', () => {
    mockState.isError = true;

    renderScreen();

    expect(screen.getByText(en.donations.loadFailed)).toBeTruthy();
    expect(screen.queryByText(en.donations.loadingImpact)).toBeNull();
  });

  it('retries the request from the error state', () => {
    mockState.isError = true;

    renderScreen();
    fireEvent.press(screen.getByText(en.common.retry));

    expect(mockState.refetch).toHaveBeenCalledTimes(1);
  });
});
