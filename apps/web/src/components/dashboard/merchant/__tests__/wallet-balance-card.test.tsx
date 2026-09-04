import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { WalletBalanceCard } from '../wallet-balance-card';

const mockUseMyWallet = jest.fn();
jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useMyWallet: () => mockUseMyWallet(),
}));

const renderCard = () =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <WalletBalanceCard />
    </NextIntlClientProvider>,
  );

describe('WalletBalanceCard', () => {
  it('shows available and pending balance, formatted with the currency', () => {
    mockUseMyWallet.mockReturnValue({
      data: { availableBalance: 128.4, pendingBalance: 42, currency: 'TND' },
      isLoading: false,
    });

    renderCard();

    expect(screen.getByText('128.40')).toBeTruthy();
    expect(screen.getByText('42.00')).toBeTruthy();
    expect(screen.getAllByText('TND')).toHaveLength(2);
  });

  it('renders zeros rather than nothing when the merchant has no wallet yet', () => {
    mockUseMyWallet.mockReturnValue({
      data: { availableBalance: 0, pendingBalance: 0, currency: 'TND' },
      isLoading: false,
    });

    renderCard();

    expect(screen.getAllByText('0.00')).toHaveLength(2);
  });
});
