import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { ImpactCards } from '../impact-cards';
import type { OrderStatsResponse } from '@/types/dashboard';

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useCarbonMetrics: () => ({ data: undefined }),
  useSocialImpact: () => ({ data: undefined }),
}));

const baseStats: OrderStatsResponse = {
  totalOrders: 10,
  totalRevenue: 240, // gross — customer paid this
  totalEarnings: 162, // net — 81% of a 200 TND subtotal
  totalOriginalValue: 300,
  pendingOrders: 0,
  confirmedOrders: 0,
  readyOrders: 0,
  completedOrders: 8,
  cancelledOrders: 0,
  averageOrderValue: 24,
  bagsSaved: 10,
};

const renderCards = (stats: OrderStatsResponse) =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <ImpactCards stats={stats} />
    </NextIntlClientProvider>,
  );

describe('ImpactCards', () => {
  it("shows the merchant's net earnings, not the gross total customers paid", () => {
    renderCards(baseStats);

    expect(screen.getByText('162')).toBeTruthy();
    expect(screen.queryByText('240')).toBeNull();
  });

  it('still computes the discount percentage off the gross total, unchanged', () => {
    // savingsPercent = (originalValue - grossRevenue) / originalValue
    // = (300 - 240) / 300 = 20%. Must NOT use totalEarnings (which would give 46%).
    // en.json: "delta": "{percent}% discount given"
    renderCards(baseStats);

    expect(screen.getByText('20% discount given')).toBeTruthy();
  });
});
