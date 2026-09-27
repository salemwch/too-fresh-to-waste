import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { TrendChart } from '../trend-chart';
import type { MerchantSalesChart } from '@/types/payments';

/**
 * `ResponsiveContainer` never measures a real size under jsdom, so it never
 * renders its children at all - the real recharts components are untestable
 * here by construction, not by an oversight. Mocking the library to plain
 * elements that expose the props TrendChart actually passes down (which
 * `dataKey` feeds the plotted line, and what `chartData` holds) is what makes
 * "earned, not bags, is what's plotted" and "the X label is Africa/Tunis"
 * checkable at all.
 */
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => (
    <div data-testid='area-chart' data-points={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid='area' data-datakey={dataKey} />,
  XAxis: ({ dataKey }: { dataKey: string }) => <div data-testid='x-axis' data-datakey={dataKey} />,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceDot: () => null,
}));

type Slot = MerchantSalesChart['slots'][number];

const renderChart = (
  slots: Slot[],
  granularity: MerchantSalesChart['granularity'] = 'day',
  locale = 'en',
) =>
  render(
    <NextIntlClientProvider locale={locale} messages={en}>
      <TrendChart slots={slots} granularity={granularity} locale={locale} />
    </NextIntlClientProvider>,
  );

describe('TrendChart', () => {
  it('plots the earnings figure, not the bag count, as the value each slot contributes to the line', () => {
    renderChart([{ start: '2026-09-01T10:00:00.000Z', orders: 2, bags: 3, earned: 12.5 }]);

    expect(screen.getByTestId('area').getAttribute('data-datakey')).toBe('earned');
    const points = JSON.parse(screen.getByTestId('area-chart').getAttribute('data-points')!);
    expect(points).toHaveLength(1);
    expect(points[0].earned).toBe(12.5);
    expect(points[0].earned).not.toBe(3);
  });

  it("labels an hourly slot in the merchant's own timezone (Africa/Tunis), not the browser's UTC", () => {
    // 2026-09-25T23:00:00Z is 2026-09-26T00:00:00 in Africa/Tunis (UTC+1, no DST).
    renderChart(
      [{ start: '2026-09-25T23:00:00.000Z', orders: 1, bags: 1, earned: 5 }],
      'hour',
      'en',
    );

    const points = JSON.parse(screen.getByTestId('area-chart').getAttribute('data-points')!);
    expect(points[0].label).toBe('00');
  });

  it('shows the empty-period message rather than an empty chart when there are no slots', () => {
    renderChart([]);

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).toBeNull();
  });
});
