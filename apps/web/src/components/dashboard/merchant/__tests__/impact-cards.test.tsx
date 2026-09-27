import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { ImpactCards } from '../impact-cards';
import type { OrderStatsResponse } from '@/types/dashboard';
import type { MerchantSalesSummary } from '@/types/payments';

const mockUseOrderStats = jest.fn();
const mockUseCarbonMetrics = jest.fn();
const mockUseSocialImpact = jest.fn();
jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useOrderStats: (...args: unknown[]) => mockUseOrderStats(...args),
  useCarbonMetrics: (...args: unknown[]) => mockUseCarbonMetrics(...args),
  useSocialImpact: (...args: unknown[]) => mockUseSocialImpact(...args),
}));

const mockUseSalesSummary = jest.fn();
jest.mock('@/hooks/use-merchant-sales', () => ({
  useSalesSummary: (...args: unknown[]) => mockUseSalesSummary(...args),
}));

const baseStats: OrderStatsResponse = {
  totalOrders: 10,
  totalRevenue: 240, // gross - not read by ImpactCards any more
  totalEarnings: 162, // not read either - summary.total.earned is, below
  totalOriginalValue: 300, // not read either - summary.total.originalValue is
  pendingOrders: 0,
  confirmedOrders: 0,
  readyOrders: 0,
  completedOrders: 8,
  cancelledOrders: 0,
  averageOrderValue: 24,
  bagsSaved: 10,
};

function summaryOf(overrides: Partial<MerchantSalesSummary['total']>): MerchantSalesSummary {
  return {
    period: 'month',
    from: null,
    to: '',
    currency: 'TND',
    total: { orders: 10, earned: 0, foodValue: 0, originalValue: 0, ...overrides },
    channels: {
      cashStore: { orders: 0, earned: 0 },
      cashDelivery: { orders: 0, earned: 0 },
      online: { orders: 0, earned: 0 },
    },
    commission: { rate: 0.19, accrued: 0, settled: 0 },
    unverifiedOrders: 0,
  };
}

const settled = (data: unknown) => ({ data, isLoading: false, isError: false });
const loading = () => ({ data: undefined, isLoading: true, isError: false });
const errored = () => ({ data: undefined, isLoading: false, isError: true });

/** Every query resolved, so a single test can override just the one it cares about. */
function mockAllSettled(summary: MerchantSalesSummary, stats: OrderStatsResponse = baseStats) {
  mockUseOrderStats.mockReturnValue(settled(stats));
  mockUseSalesSummary.mockReturnValue(settled(summary));
  mockUseCarbonMetrics.mockReturnValue(settled(undefined));
  mockUseSocialImpact.mockReturnValue(settled(undefined));
}

const renderCards = (period: 'today' | '7d' | '30d' | 'month' | 'all' = 'month') =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <ImpactCards period={period} />
    </NextIntlClientProvider>,
  );

describe('ImpactCards', () => {
  beforeEach(() => {
    mockUseOrderStats.mockReset();
    mockUseSalesSummary.mockReset();
    mockUseCarbonMetrics.mockReset();
    mockUseSocialImpact.mockReset();
  });

  it("shows the merchant's net earnings from the shared earnings summary, not the order-stats gross total", () => {
    mockAllSettled(summaryOf({ earned: 162, originalValue: 300, foodValue: 240 }));
    renderCards();

    expect(screen.getByText('162')).toBeTruthy();
    // 240 is `baseStats.totalRevenue` - must not leak in as a card value.
    expect(screen.queryByText('240')).toBeNull();
  });

  it('computes the discount percentage from food value vs original value, not gross revenue', () => {
    // originalValue 20, foodValue 10 -> (20 - 10) / 20 = 50%.
    mockAllSettled(summaryOf({ earned: 8, originalValue: 20, foodValue: 10 }));
    renderCards();

    expect(screen.getByText('50% discount given')).toBeTruthy();
  });

  it('passes `period` to every one of its four queries', () => {
    mockAllSettled(summaryOf({}));
    renderCards('7d');

    expect(mockUseOrderStats).toHaveBeenCalledWith('7d');
    expect(mockUseSalesSummary).toHaveBeenCalledWith('7d');
    expect(mockUseCarbonMetrics).toHaveBeenCalledWith('7d');
    expect(mockUseSocialImpact).toHaveBeenCalledWith('7d');
  });

  it('interpolates the actual period into copy that used to always say "this period"/"this month"', () => {
    mockUseOrderStats.mockReturnValue(settled(baseStats));
    mockUseSalesSummary.mockReturnValue(settled(summaryOf({})));
    mockUseCarbonMetrics.mockReturnValue(settled({ carbonKgAvoided: 5, carKmEquivalent: 40 }));
    mockUseSocialImpact.mockReturnValue(settled({ mealsDistributed: 3, peopleServedEstimate: 1 }));
    renderCards('today');

    // en.json: "delta": "avoided - {period}" / "note": "~{people} people served - {period}."
    expect(screen.getByText('avoided - Today')).toBeTruthy();
    expect(screen.getByText('~1 people served - Today.')).toBeTruthy();
  });

  it.each([
    ['stats', mockUseOrderStats],
    ['summary', mockUseSalesSummary],
    ['carbon', mockUseCarbonMetrics],
    ['social', mockUseSocialImpact],
  ])('shows a skeleton, not invented zeros, while %s is still loading', (_which, mock) => {
    mockAllSettled(summaryOf({}));
    (mock as jest.Mock).mockReturnValue(loading());
    renderCards();

    expect(screen.queryByTestId('impact-cards-error')).toBeNull();
    // None of the KPI copy (which would only be reachable past the loading
    // guard) is on screen while any one of the four queries is still loading.
    expect(screen.queryByText(/discount given/)).toBeNull();
    expect(screen.queryByText(/completion rate/)).toBeNull();
  });

  it.each([
    ['stats', mockUseOrderStats],
    ['summary', mockUseSalesSummary],
    ['carbon', mockUseCarbonMetrics],
    ['social', mockUseSocialImpact],
  ])('shows a translated error, not invented zeros, when %s fails to load', (_which, mock) => {
    mockAllSettled(summaryOf({}));
    (mock as jest.Mock).mockReturnValue(errored());
    renderCards();

    expect(screen.getByTestId('impact-cards-error')).toHaveTextContent(
      'Could not load your impact figures.',
    );
    expect(screen.queryByText(/discount given/)).toBeNull();
  });
});
