import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { ImpactCards } from '../impact-cards';
import type { OrderStatsResponse } from '@/types/dashboard';
import type { MerchantSalesSummary } from '@/types/payments';

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useCarbonMetrics: () => ({ data: undefined }),
  useSocialImpact: () => ({ data: undefined }),
}));

const baseStats: OrderStatsResponse = {
  totalOrders: 10,
  totalRevenue: 240, // gross — no longer read by ImpactCards, kept for the type
  totalEarnings: 162, // no longer read by ImpactCards either — summary.total.earned is
  totalOriginalValue: 300, // no longer read by ImpactCards — summary.total.originalValue is
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

const renderCards = (stats: OrderStatsResponse, summary: MerchantSalesSummary | undefined) =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <ImpactCards stats={stats} summary={summary} />
    </NextIntlClientProvider>,
  );

describe('ImpactCards', () => {
  it("shows the merchant's net earnings from the shared earnings summary, not the order-stats gross total", () => {
    const summary = summaryOf({ earned: 162, originalValue: 300, foodValue: 240 });
    renderCards(baseStats, summary);

    expect(screen.getByText('162')).toBeTruthy();
    // 240 was the old `totalRevenue` fixture value — must not leak in as a card value.
    expect(screen.queryByText('240')).toBeNull();
  });

  it('computes the discount percentage from food value vs original value, not gross revenue', () => {
    // originalValue 20, foodValue 10 -> (20 - 10) / 20 = 50%.
    const summary = summaryOf({ earned: 8, originalValue: 20, foodValue: 10 });
    renderCards(baseStats, summary);

    expect(screen.getByText('50% discount given')).toBeTruthy();
  });

  it("a delivery order's fee cannot change the discount percentage - the summary carries no fee", () => {
    // Same food economics as above (originalValue 20, foodValue 10 -> 50%), but
    // this order also had a delivery fee. `summary.total` has no fee field at
    // all, so there is nothing for a delivery order to inflate or shrink here.
    const summary = summaryOf({ earned: 8, originalValue: 20, foodValue: 10 });
    renderCards(baseStats, summary);

    expect(screen.getByText('50% discount given')).toBeTruthy();
    expect('deliveryFee' in summary.total).toBe(false);
  });

  it('renders zero-valued cards rather than throwing when the summary has not loaded yet', () => {
    renderCards(baseStats, undefined);

    expect(screen.getByText('0% discount given')).toBeTruthy();
  });
});
