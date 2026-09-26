import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import { CommissionCard } from '../commission-card';

import type { MerchantCommissionStatement } from '@/types/dashboard';

const mockUseCommissionStatement = jest.fn();
jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useCommissionStatement: () => mockUseCommissionStatement(),
}));

const statement = (
  over: Partial<MerchantCommissionStatement> = {},
): MerchantCommissionStatement => ({
  commissionDue: 0,
  dueByEstablishment: [],
  sales: 35,
  commission: 6.65,
  received: 28.35,
  rate: 0.19,
  fullPriceOrders: 0,
  settledOrders: 0,
  currency: 'TND',
  recentSettlements: [],
  ...over,
});

const renderCard = () =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <CommissionCard />
    </NextIntlClientProvider>,
  );

describe('CommissionCard', () => {
  it('shows the month once the statement arrives', () => {
    mockUseCommissionStatement.mockReturnValue({
      data: statement(),
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.getByText(en.dashboard.commission.title)).toBeTruthy();
    expect(screen.getByText(en.dashboard.commission.received)).toBeTruthy();
    expect(screen.queryByTestId('commission-card-skeleton')).toBeNull();
  });

  it('shows the no-sales message rather than a skeleton for an empty month', () => {
    mockUseCommissionStatement.mockReturnValue({
      data: statement({ sales: 0, commission: 0, received: 0 }),
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.getByText(en.dashboard.commission.noActivity)).toBeTruthy();
    expect(screen.queryByTestId('commission-card-skeleton')).toBeNull();
  });

  it('names each location carrying a balance under "All locations"', () => {
    mockUseCommissionStatement.mockReturnValue({
      data: statement({
        commissionDue: 4.75,
        dueByEstablishment: [
          { establishmentId: 'a', name: 'Pâtisserie Lac', amount: 3.8 },
          { establishmentId: 'b', name: 'Pâtisserie Marsa', amount: 0.95 },
        ],
      }),
      isLoading: false,
      isError: false,
    });

    renderCard();

    const breakdown = screen.getByLabelText(en.dashboard.commission.toSettleByLocation);
    expect(breakdown.textContent).toContain('Pâtisserie Lac');
    expect(breakdown.textContent).toContain('Pâtisserie Marsa');
  });

  it('shows no breakdown for a single location - it would only repeat the total', () => {
    mockUseCommissionStatement.mockReturnValue({
      data: statement({
        commissionDue: 1.9,
        dueByEstablishment: [{ establishmentId: 'a', name: 'Only', amount: 1.9 }],
      }),
      isLoading: false,
      isError: false,
    });

    renderCard();

    expect(screen.queryByLabelText(en.dashboard.commission.toSettleByLocation)).toBeNull();
  });

  it('shows the error message when the request fails', () => {
    mockUseCommissionStatement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderCard();

    expect(screen.getByText(en.dashboard.commission.error)).toBeTruthy();
  });
});
