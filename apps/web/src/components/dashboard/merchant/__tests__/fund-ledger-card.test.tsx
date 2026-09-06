import { render, screen, within } from '@testing-library/react';

import { FundLedgerCard } from '../fund-ledger-card';
import { useFundLedger } from '@/hooks/use-merchant-dashboard';

jest.mock('@/hooks/use-merchant-dashboard');
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}));

const mockUseFundLedger = useFundLedger as jest.MockedFunction<typeof useFundLedger>;

function mockState(overrides: Partial<ReturnType<typeof useFundLedger>>) {
  mockUseFundLedger.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useFundLedger>);
}

describe('FundLedgerCard', () => {
  it('renders a skeleton while loading', () => {
    mockState({ isLoading: true });
    const { container } = render(<FundLedgerCard />);
    expect(container.querySelector('[data-testid="fund-ledger-skeleton"]')).toBeInTheDocument();
  });

  it('renders a translated error message, never a status code', () => {
    mockState({ isError: true });
    render(<FundLedgerCard />);
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('renders the empty state for a merchant with no contributions', () => {
    mockState({
      data: {
        totalTnd: 0,
        currency: 'TND',
        contributionCount: 0,
        items: [],
        totalItems: 0,
        firstContributionAt: null,
      },
    });
    render(<FundLedgerCard />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('shows the exact total and the funded item breakdown', () => {
    mockState({
      data: {
        totalTnd: 47.35,
        currency: 'TND',
        contributionCount: 12,
        items: [
          { category: 'TSHIRTS', count: 3, amountTnd: 35 },
          { category: 'MEDICINE', count: 2, amountTnd: 12.35 },
        ],
        totalItems: 5,
        firstContributionAt: '2026-03-01T00:00:00.000Z',
      },
    });
    render(<FundLedgerCard />);

    // The total (47.35 -> "47.350" at 3 decimal places) and the TSHIRTS
    // item count (3) both contain the digit "3", so a document-wide /3/
    // match is ambiguous. Scope to the funded-items list to assert the
    // count unambiguously, without changing the underlying test data.
    expect(screen.getByText(/47\.35/)).toBeInTheDocument();
    const fundedItemsList = screen.getByRole('list');
    expect(within(fundedItemsList).getByText('3')).toBeInTheDocument();
    expect(screen.getByText('categories.TSHIRTS')).toBeInTheDocument();
  });

  it('hides a category that funded zero whole items', () => {
    // 4 TND toward a 10 TND t-shirt is real money but zero t-shirts. Showing
    // "0 t-shirts" reads as failure; the TND total still carries it.
    mockState({
      data: {
        totalTnd: 4,
        currency: 'TND',
        contributionCount: 1,
        items: [{ category: 'TSHIRTS', count: 0, amountTnd: 4 }],
        totalItems: 0,
        firstContributionAt: '2026-08-01T00:00:00.000Z',
      },
    });
    render(<FundLedgerCard />);

    expect(screen.queryByText('categories.TSHIRTS')).not.toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });

  it('shows the total number of funded items using itemsLabel', () => {
    mockState({
      data: {
        totalTnd: 47.35,
        currency: 'TND',
        contributionCount: 12,
        items: [
          { category: 'TSHIRTS', count: 3, amountTnd: 35 },
          { category: 'MEDICINE', count: 2, amountTnd: 12.35 },
        ],
        totalItems: 5,
        firstContributionAt: '2026-03-01T00:00:00.000Z',
      },
    });
    render(<FundLedgerCard />);

    const itemsTotal = screen.getByTestId('fund-ledger-items-total');
    expect(within(itemsTotal).getByText('5')).toBeTruthy();
    expect(within(itemsTotal).getByText('itemsLabel')).toBeTruthy();
  });

  it('shows the since line with a formatted date when firstContributionAt is set', () => {
    mockState({
      data: {
        totalTnd: 10,
        currency: 'TND',
        contributionCount: 3,
        items: [{ category: 'MEDICINE', count: 1, amountTnd: 10 }],
        totalItems: 1,
        firstContributionAt: '2026-03-01T00:00:00.000Z',
      },
    });
    render(<FundLedgerCard />);

    expect(screen.getByTestId('fund-ledger-since')).toBeTruthy();
    // Never a raw ISO string, regardless of how it is formatted.
    expect(screen.queryByText(/2026-03-01/)).toBeNull();
  });

  it('hides the since line when firstContributionAt is null, even with contributions', () => {
    mockState({
      data: {
        totalTnd: 10,
        currency: 'TND',
        contributionCount: 3,
        items: [{ category: 'MEDICINE', count: 1, amountTnd: 10 }],
        totalItems: 1,
        firstContributionAt: null,
      },
    });
    render(<FundLedgerCard />);

    expect(screen.queryByTestId('fund-ledger-since')).toBeNull();
  });
});
