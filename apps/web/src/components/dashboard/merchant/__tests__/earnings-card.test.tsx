import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';
import { EarningsCard } from '../earnings-card';
import type { SalesPeriod } from '@/types/payments';

const mockUseSalesSummary = jest.fn();
jest.mock('@/hooks/use-merchant-sales', () => ({
  useSalesSummary: (...args: unknown[]) => mockUseSalesSummary(...args),
}));

// The card must never call the wallet hook at all any more (task-15b moved
// "Money TFTW currently holds" to the top of the Payments page) - mocking the
// module and asserting zero calls means a regression that re-adds the import
// fails here, not just visually.
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
  });

  it('shows the total, then the three lines, which add up to it', () => {
    mockUseSalesSummary.mockReturnValue({ data: summary, isLoading: false, isError: false });
    renderCard();
    expect(screen.getByTestId('earnings-total')).toHaveTextContent('1,284.500');
    expect(screen.getByText('Cash collected in store')).toBeInTheDocument();
    expect(screen.getByText('Cash collected via delivery')).toBeInTheDocument();
    expect(screen.getByText('Paid online')).toBeInTheDocument();
  });

  // task-15b: the held balance moved to the top of the Payments page and was
  // removed from the Dashboard entirely - not hidden, not moved to a
  // collapsed section, gone. Both halves are asserted: nothing that used to
  // identify the section is on screen, AND the hook that fed it is never
  // called, so a regression that re-adds either the markup or the call fails.
  it('never renders the held-balance section and never calls the wallet hook', () => {
    mockUseSalesSummary.mockReturnValue({ data: summary, isLoading: false, isError: false });
    renderCard();
    expect(screen.queryByText('Money TFTW currently holds')).toBeNull();
    expect(screen.queryByText('Available for payout')).toBeNull();
    expect(screen.queryByText('Awaiting pickup')).toBeNull();
    expect(mockUseMyWallet).not.toHaveBeenCalled();
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

  // task-15b: a period change re-renders the card, and the wallet hook must
  // still never be called - the card no longer reads it under any period.
  it('never calls the wallet hook across period changes either', () => {
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

    expect(mockUseMyWallet).not.toHaveBeenCalled();
  });
});
