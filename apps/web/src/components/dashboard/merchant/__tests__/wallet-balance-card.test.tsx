import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { WalletBalanceCard } from '../wallet-balance-card';

const mockUseMyWallet = jest.fn();
jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useMyWallet: () => mockUseMyWallet(),
}));

const w = en.dashboard.walletBalance;

const renderCard = () =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <WalletBalanceCard />
    </NextIntlClientProvider>,
  );

describe('WalletBalanceCard', () => {
  it('shows available and pending balance with the currency', () => {
    mockUseMyWallet.mockReturnValue({
      data: { availableBalance: 128.4, pendingBalance: 42, currency: 'TND' },
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.getByText(/128\.400/)).toBeTruthy();
    expect(screen.getByText(/42\.000/)).toBeTruthy();
    expect(screen.getAllByText(/TND/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders zeros rather than nothing when the merchant has no wallet yet', () => {
    mockUseMyWallet.mockReturnValue({
      data: { availableBalance: 0, pendingBalance: 0, currency: 'TND' },
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.getAllByText(/0\.000/)).toHaveLength(2);
  });

  it('says plainly that cash orders are not part of this balance', () => {
    mockUseMyWallet.mockReturnValue({
      data: { availableBalance: 0, pendingBalance: 0, currency: 'TND' },
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.getByText(w.cashNotHere)).toBeTruthy();
  });

  it('explains Awaiting pickup truthfully: it moves when the pickup is confirmed', () => {
    mockUseMyWallet.mockReturnValue({
      data: { availableBalance: 0, pendingBalance: 5, currency: 'TND' },
      isLoading: false,
      isError: false,
    });

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: w.pendingInfoLabel }));

    const info = screen.getByText(w.pendingInfo);
    expect(info.hidden).toBe(false);
    expect(info.textContent).toMatch(/confirm the pickup/);
    expect(info.textContent).not.toMatch(/window/);
  });

  it('shows an error, not an endless skeleton, when the request fails', () => {
    mockUseMyWallet.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderCard();

    expect(screen.getByText(w.error)).toBeTruthy();
    expect(screen.queryByTestId('wallet-balance-skeleton')).toBeNull();
  });
});
