import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../../messages/en.json';
import { AnalyticsPage } from '../analytics-page';
import type { BusinessMetrics } from '@/types/dashboard';

const metricValue = (value: number) => ({ value, trend: 'stable' as const });

const metrics: BusinessMetrics = {
  totalEarnings: metricValue(162),
  totalOrders: metricValue(10),
  averageFoodValue: metricValue(20),
  conversionRate: metricValue(80),
  customerAcquisitionCost: metricValue(0),
  customerLifetimeValue: metricValue(0),
  foodWasteSaved: metricValue(50),
  carbonFootprintReduced: metricValue(20),
  waterSaved: metricValue(100),
  packagingSaved: metricValue(5),
  energySaved: metricValue(10),
};

const mockUseBusinessMetrics = jest.fn();
const mockUseSalesChart = jest.fn();

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useBusinessMetrics: (...args: unknown[]) => mockUseBusinessMetrics(...args),
  useCustomerLocations: () => ({ data: [], isLoading: false }),
  useMyEstablishments: () => ({ data: [] }),
}));

jest.mock('@/hooks/use-merchant-sales', () => ({
  useSalesChart: (...args: unknown[]) => mockUseSalesChart(...args),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/i18n/routing', () => ({
  usePathname: () => '/en/merchant/analytics',
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('@/components/dashboard/merchant', () => {
  const actual = jest.requireActual('@/components/dashboard/merchant');
  return {
    ...actual,
    TrendChart: () => null,
    TrendChartSkeleton: () => null,
    TrendChartError: () => null,
  };
});

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockUseBusinessMetrics.mockReset().mockReturnValue({
      data: metrics,
      isLoading: false,
      isError: false,
    });
    mockUseSalesChart.mockReset().mockReturnValue({ data: undefined, isLoading: false });
  });

  it('shows net earnings (162), not the gross customer total, on the Revenue KPI card', () => {
    render(
      <NextIntlClientProvider locale='en' messages={en}>
        <AnalyticsPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('162.00')).toBeTruthy();
  });

  it('reads averageFoodValue on the Avg. Food Value card - never averageOrderValue', () => {
    render(
      <NextIntlClientProvider locale='en' messages={en}>
        <AnalyticsPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('20.00')).toBeTruthy();
    expect(screen.getByText('Average food value per completed order')).toBeTruthy();
  });

  it('passes the URL period to both useBusinessMetrics and useSalesChart, defaulting to month', () => {
    render(
      <NextIntlClientProvider locale='en' messages={en}>
        <AnalyticsPage />
      </NextIntlClientProvider>,
    );

    expect(mockUseBusinessMetrics).toHaveBeenCalledWith('month');
    expect(mockUseSalesChart).toHaveBeenCalledWith('month');
  });
});
