import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { TodaySalesCard } from '../today-sales-card';

import type { TodaySales } from '@/types/dashboard';

const mockUseTodaySales = jest.fn();
jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useTodaySales: () => mockUseTodaySales(),
}));

const tt = en.dashboard.todaySales;

const day = (over: Partial<TodaySales> = {}): TodaySales => ({
  date: '2026-09-24',
  currency: 'TND',
  rate: 0.19,
  cash: { orders: 1, sales: 10 },
  online: { orders: 1, sales: 10 },
  // One NORMAL 10 (1.90 recorded) + one SETTLEMENT 10 paid 5 (5 settled).
  total: { orders: 2, sales: 20, commission: 1.9, settled: 5, received: 15, kept: 13.1 },
  toCollect: { orders: 0, sales: 0 },
  ...over,
});

const renderCard = () =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <TodaySalesCard />
    </NextIntlClientProvider>,
  );

describe('TodaySalesCard', () => {
  it('shows cash and online sales together, with the day total', () => {
    mockUseTodaySales.mockReturnValue({ data: day(), isLoading: false, isError: false });

    renderCard();

    expect(screen.getByText(/20\.000/)).toBeTruthy();
    expect(screen.getByText(tt.cash)).toBeTruthy();
    expect(screen.getByText(tt.online)).toBeTruthy();
  });

  it("shows today's profit from the backend, never recomputing 19% of sales", () => {
    mockUseTodaySales.mockReturnValue({ data: day(), isLoading: false, isError: false });

    renderCard();

    // 13.10, not 20 x 0.81 = 16.20.
    expect(screen.getByText(/13\.100/)).toBeTruthy();
    expect(screen.queryByText(/16\.200/)).toBeNull();
  });

  it('shows the settled line only on a day with a settlement order', () => {
    mockUseTodaySales.mockReturnValue({
      data: day({
        total: { orders: 1, sales: 10, commission: 1.9, settled: 0, received: 10, kept: 8.1 },
      }),
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.queryByText(tt.settled)).toBeNull();
  });

  it('shows an empty day as an invitation, not as zeros', () => {
    mockUseTodaySales.mockReturnValue({
      data: day({
        cash: { orders: 0, sales: 0 },
        online: { orders: 0, sales: 0 },
        total: { orders: 0, sales: 0, commission: 0, settled: 0, received: 0, kept: 0 },
      }),
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.getByText(tt.empty)).toBeTruthy();
  });

  it('mentions orders still to collect, separately from sales', () => {
    mockUseTodaySales.mockReturnValue({
      data: day({ toCollect: { orders: 2, sales: 17 } }),
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.getByText(/2 orders still to collect/)).toBeTruthy();
  });

  it('links to the payments history for finished days', () => {
    mockUseTodaySales.mockReturnValue({ data: day(), isLoading: false, isError: false });

    renderCard();

    expect(screen.getByRole('link', { name: new RegExp(tt.history) }).getAttribute('href')).toMatch(
      /\/merchant\/payments$/,
    );
  });

  it('shows the error message when the request fails', () => {
    mockUseTodaySales.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderCard();

    expect(screen.getByText(tt.error)).toBeTruthy();
  });
});
