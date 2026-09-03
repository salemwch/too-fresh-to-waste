import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../../messages/en.json';
import { AnalyticsPage } from '../analytics-page';
import type { BusinessMetrics, RevenueChartItem } from '@/types/dashboard';

const metricValue = (value: number) => ({ value, trend: 'stable' as const });

const metrics: BusinessMetrics = {
  totalRevenue: metricValue(240),
  totalEarnings: metricValue(162),
  totalOrders: metricValue(10),
  averageOrderValue: metricValue(24),
  conversionRate: metricValue(80),
  customerAcquisitionCost: metricValue(0),
  customerLifetimeValue: metricValue(0),
  foodWasteSaved: metricValue(50),
  carbonFootprintReduced: metricValue(20),
  waterSaved: metricValue(100),
  packagingSaved: metricValue(5),
  energySaved: metricValue(10),
};

const chart: RevenueChartItem[] = [
  {
    label: '1 Jan',
    year: 2026,
    month: 1,
    day: 1,
    revenue: 240,
    earnings: 162,
    orderCount: 10,
    bagCount: 10,
  },
];

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useBusinessMetrics: () => ({ data: metrics, isLoading: false, isError: false }),
  useRevenueChart: () => ({ data: chart, isLoading: false }),
  useCustomerLocations: () => ({ data: [], isLoading: false }),
  useMyEstablishments: () => ({ data: [] }),
}));

describe('AnalyticsPage', () => {
  it('shows net earnings (162), not the gross total (240), on the Revenue KPI card', () => {
    render(
      <NextIntlClientProvider locale='en' messages={en}>
        <AnalyticsPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('162.00')).toBeTruthy();
    expect(screen.queryByText('240.00')).toBeNull();
  });
});
