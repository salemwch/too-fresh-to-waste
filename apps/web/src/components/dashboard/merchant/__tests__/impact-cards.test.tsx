import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { ImpactCards } from '../impact-cards';
import type { OrderStatsResponse } from '@/types/dashboard';
import type { MerchantSalesSummary } from '@/types/payments';

const mockUseOrderStats = jest.fn();
const mockUseCarbonMetrics = jest.fn();
const mockUseSocialImpact = jest.fn();
const mockUseMyEstablishment = jest.fn();
jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useOrderStats: (...args: unknown[]) => mockUseOrderStats(...args),
  useCarbonMetrics: (...args: unknown[]) => mockUseCarbonMetrics(...args),
  useSocialImpact: (...args: unknown[]) => mockUseSocialImpact(...args),
  useMyEstablishment: (...args: unknown[]) => mockUseMyEstablishment(...args),
}));

const mockUseSalesSummary = jest.fn();
jest.mock('@/hooks/use-merchant-sales', () => ({
  useSalesSummary: (...args: unknown[]) => mockUseSalesSummary(...args),
}));

const baseStats: OrderStatsResponse = {
  totalOrders: 10,
  pendingOrders: 0,
  confirmedOrders: 0,
  readyOrders: 0,
  completedOrders: 8,
  cancelledOrders: 0,
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

const settled = (data: unknown) => ({ data, isLoading: false, isError: false, error: null });
const loading = () => ({ data: undefined, isLoading: true, isError: false, error: null });
const errored = (code?: string) => ({
  data: undefined,
  isLoading: false,
  isError: true,
  error: code ? { response: { data: { code } } } : new Error('boom'),
});

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
    // No establishment -> SubscriptionModal never mounts; not under test here.
    mockUseMyEstablishment.mockReset().mockReturnValue({ data: undefined });
  });

  it("shows the merchant's net earnings from the shared earnings summary, not the order-stats gross total", () => {
    mockAllSettled(summaryOf({ earned: 162, originalValue: 300, foodValue: 240 }));
    renderCards();

    expect(screen.getByText('162')).toBeTruthy();
    // 240 is the summary's `foodValue`, not `earned` - must not leak in as
    // the revenue card's value (Task 16 removed the old `totalRevenue` gross
    // figure from `OrderStatsResponse` entirely, so this now proves the same
    // thing against the shared earnings summary instead).
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

  it('shows a skeleton for just the cards backed by the query that is still loading, not the whole grid', () => {
    mockUseOrderStats.mockReturnValue(settled(baseStats));
    mockUseSalesSummary.mockReturnValue(settled(summaryOf({ earned: 42 })));
    mockUseCarbonMetrics.mockReturnValue(loading());
    mockUseSocialImpact.mockReturnValue(settled({ mealsDistributed: 1, peopleServedEstimate: 1 }));
    renderCards();

    // Summary-backed cards (rescued, revenue) render normally...
    expect(screen.getByText('42')).toBeTruthy();
    // ...while only the carbon-backed cards (carbon, water - 2 of them) show a skeleton.
    expect(screen.getAllByTestId('impact-card-skeleton')).toHaveLength(2);
  });

  it('a failing query only errors the cards backed by it, leaving the others showing real values', () => {
    mockUseOrderStats.mockReturnValue(settled(baseStats));
    mockUseSalesSummary.mockReturnValue(
      settled(summaryOf({ earned: 42, originalValue: 20, foodValue: 10 })),
    );
    mockUseCarbonMetrics.mockReturnValue(errored());
    mockUseSocialImpact.mockReturnValue(settled({ mealsDistributed: 1, peopleServedEstimate: 1 }));
    renderCards();

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('50% discount given')).toBeTruthy();
    expect(screen.getAllByTestId('impact-card-error')).toHaveLength(2); // carbon + water
    expect(screen.queryByTestId('impact-card-locked')).toBeNull();
  });

  it('a background refetch failing keeps showing the values already on screen, for every card', () => {
    mockUseOrderStats.mockReturnValue({ ...settled(baseStats), isError: true });
    mockUseSalesSummary.mockReturnValue({
      ...settled(summaryOf({ earned: 42, originalValue: 20, foodValue: 10 })),
      isError: true,
    });
    mockUseCarbonMetrics.mockReturnValue({
      ...settled({ carbonKgAvoided: 5, carKmEquivalent: 40, waterLitersAvoided: 100 }),
      isError: true,
    });
    mockUseSocialImpact.mockReturnValue({
      ...settled({ mealsDistributed: 1, peopleServedEstimate: 1 }),
      isError: true,
    });
    renderCards();

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('50% discount given')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy(); // carbonKg
    expect(screen.queryByTestId('impact-card-error')).toBeNull();
    expect(screen.queryByTestId('impact-card-locked')).toBeNull();
  });

  it('a non-Pro merchant sees the three money/completion cards with real values and a locked state on the two Pro cards', () => {
    mockUseOrderStats.mockReturnValue(settled(baseStats));
    mockUseSalesSummary.mockReturnValue(
      settled(summaryOf({ earned: 42, originalValue: 20, foodValue: 10 })),
    );
    mockUseCarbonMetrics.mockReturnValue(errored('PRO_PLAN_REQUIRED'));
    mockUseSocialImpact.mockReturnValue(errored('PRO_PLAN_REQUIRED'));
    renderCards();

    // Rescued + earned revenue still show real values - never gated by carbon/social.
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('50% discount given')).toBeTruthy();
    expect(screen.getByText('+80% completion rate')).toBeTruthy();

    // Carbon + water (1 query) + social (1 query) = 3 locked cards, reusing
    // the ProGate upsell copy, not a generic error.
    expect(screen.getAllByTestId('impact-card-locked')).toHaveLength(3);
    expect(screen.getAllByText('Pro Feature').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Upgrade to Pro').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('impact-card-error')).toBeNull();
  });

  it('hides the completion-rate delta rather than showing a fabricated "+0%" when order stats has no data', () => {
    mockUseOrderStats.mockReturnValue(errored());
    mockUseSalesSummary.mockReturnValue(settled(summaryOf({ earned: 42 })));
    mockUseCarbonMetrics.mockReturnValue(settled(undefined));
    mockUseSocialImpact.mockReturnValue(settled(undefined));
    renderCards();

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.queryByText(/completion rate/)).toBeNull();
  });
});
