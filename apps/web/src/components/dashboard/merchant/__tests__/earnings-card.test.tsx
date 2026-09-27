import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';
import { EarningsCard } from '../earnings-card';
import type { SalesPeriod } from '@/types/payments';

const mockUseSalesSummary = jest.fn();
jest.mock('@/hooks/use-merchant-sales', () => ({
  useSalesSummary: (...args: unknown[]) => mockUseSalesSummary(...args),
}));

const mockUseMyWallet = jest.fn();
jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useMyWallet: (...args: unknown[]) => mockUseMyWallet(...args),
}));

const summary = {
  period: 'month',
  from: null,
  to: '',
  currency: 'TND',
  total: { orders: 42, earned: 1284.5, foodValue: 1500, originalValue: 1800 },
  channels: {
    cashStore: { orders: 20, earned: 612 },
    cashDelivery: { orders: 8, earned: 180.5 },
    online: { orders: 14, earned: 492 },
  },
  commission: { rate: 0.19, accrued: 198.3, settled: 45 },
  unverifiedOrders: 0,
};
const wallet = { availableBalance: 310, pendingBalance: 96, currency: 'TND' };

const renderCard = (period: SalesPeriod = 'month') =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <EarningsCard period={period} />
    </NextIntlClientProvider>,
  );

describe('EarningsCard', () => {
  beforeEach(() => {
    mockUseSalesSummary.mockReset();
    mockUseMyWallet.mockReset();
    mockUseMyWallet.mockReturnValue({ data: wallet, isLoading: false, isError: false });
  });

  it('shows the total, then the three lines, which add up to it', () => {
    mockUseSalesSummary.mockReturnValue({ data: summary, isLoading: false, isError: false });
    renderCard();
    expect(screen.getByTestId('earnings-total')).toHaveTextContent('1,284.500');
    expect(screen.getByText('Cash collected in store')).toBeInTheDocument();
    expect(screen.getByText('Cash collected via delivery')).toBeInTheDocument();
    expect(screen.getByText('Paid online')).toBeInTheDocument();
  });

  it('shows what TFTW holds right now, from the wallet, separately', () => {
    mockUseSalesSummary.mockReturnValue({ data: summary, isLoading: false, isError: false });
    renderCard();
    expect(screen.getByRole('region', { name: 'Money TFTW currently holds' })).toHaveTextContent(
      '310.000',
    );
  });

  it('shows the verification notice when sales are left out', () => {
    mockUseSalesSummary.mockReturnValue({
      data: { ...summary, unverifiedOrders: 2 },
      isLoading: false,
      isError: false,
    });
    renderCard();
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 sales are being verified and are not included yet',
    );
  });

  it.each([
    ['loading', { isLoading: true, isError: false, data: undefined }, 'earnings-skeleton'],
    ['error', { isLoading: false, isError: true, data: undefined }, 'earnings-error'],
  ])('%s state', (_label, state, testId) => {
    mockUseSalesSummary.mockReturnValue(state);
    renderCard();
    expect(screen.getByTestId(testId as string)).toBeInTheDocument();
  });

  it('empty period says so instead of showing zeros only', () => {
    mockUseSalesSummary.mockReturnValue({
      data: { ...summary, total: { ...summary.total, orders: 0, earned: 0 } },
      isLoading: false,
      isError: false,
    });
    renderCard();
    expect(screen.getByText('No sales in this period yet.')).toBeInTheDocument();
  });

  // Fix-round item 8: a background refetch failing (e.g. the query refires
  // after a period change) must not blank out data already on screen -
  // TanStack keeps `data` populated with the last good result while
  // `isError` flips true, and the card must keep rendering it.
  it('keeps showing the earnings already on screen when a background refetch fails', () => {
    mockUseSalesSummary.mockReturnValue({ data: summary, isLoading: false, isError: true });
    renderCard();

    expect(screen.queryByTestId('earnings-error')).toBeNull();
    expect(screen.getByTestId('earnings-total')).toHaveTextContent('1,284.500');
  });

  it('keeps showing the held balance already on screen when its background refetch fails', () => {
    mockUseSalesSummary.mockReturnValue({ data: summary, isLoading: false, isError: false });
    mockUseMyWallet.mockReturnValue({ data: wallet, isLoading: false, isError: true });
    renderCard();

    expect(screen.getByRole('region', { name: 'Money TFTW currently holds' })).toHaveTextContent(
      '310.000',
    );
    expect(screen.queryByText('Could not load the balance TFTW holds.')).toBeNull();
  });

  // Mutation-check (task-13-brief Step 8): the wallet's query key has no
  // period (CLAUDE.md - "never put the viewer's id in a cache key" applies
  // the same way here - the held balance is not scoped by whatever period the
  // merchant happens to be looking at). The mock forwards every argument the
  // component actually passes, so if `EarningsCard` ever starts threading
  // `period` into `useMyWallet(...)`, the recorded call gains an argument and
  // this fails.
  it('never passes the period into the wallet query, across period changes', () => {
    mockUseSalesSummary.mockReturnValue({ data: summary, isLoading: false, isError: false });

    const { rerender } = render(
      <NextIntlClientProvider locale='en' messages={en}>
        <EarningsCard period='month' />
      </NextIntlClientProvider>,
    );
    rerender(
      <NextIntlClientProvider locale='en' messages={en}>
        <EarningsCard period='7d' />
      </NextIntlClientProvider>,
    );

    expect(mockUseMyWallet).toHaveBeenCalledTimes(2);
    for (const call of mockUseMyWallet.mock.calls) {
      expect(call).toEqual([]);
    }
  });
});
