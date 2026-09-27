import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../../messages/en.json';
import { PaymentsPage } from '../payments-page';
import type {
  EarningsRow,
  EarningsRowsPage,
  EarningsTab,
  MerchantSalesSummary,
} from '@/types/payments';

/**
 * The Payments tab reads two things from the shared earnings calculation:
 * the stats card (`usePaymentStats`) and the per-tab row list
 * (`useMerchantEarningsRows`). Both are mocked here so this suite drives the
 * page's own logic (tab switching, period switching, loading/empty/error) -
 * the calculation itself is covered by
 * merchant-sales.integration.spec.ts on the backend.
 *
 * `useSalesPeriod` is mocked with a real `useState` so clicking a `PeriodBar`
 * button behaves exactly like the URL-backed hook without needing
 * `next/navigation` wired up (see use-sales-period.test.tsx for that hook's
 * own coverage).
 */

let period: 'today' | '7d' | '30d' | 'month' | 'all' = 'month';

jest.mock('@/hooks/use-sales-period', () => {
  const { useState } = jest.requireActual('react');
  return {
    useSalesPeriod: () => {
      const [value, setValue] = useState(period);
      return [
        value,
        (next: typeof period) => {
          period = next;
          setValue(next);
        },
      ];
    },
  };
});

const statsSpy = jest.fn();
const rowsSpy = jest.fn();
const statsRefetch = jest.fn();
const rowsRefetch = jest.fn();
const fetchNextPage = jest.fn();

const mockSummary: MerchantSalesSummary = {
  period: 'month',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-09-27T00:00:00.000Z',
  currency: 'TND',
  total: { orders: 3, earned: 30, foodValue: 33, originalValue: 35 },
  channels: {
    cashStore: { orders: 1, earned: 10 },
    cashDelivery: { orders: 1, earned: 8 },
    online: { orders: 1, earned: 12 },
  },
  commission: { rate: 0.19, accrued: 5.7, settled: 0 },
  unverifiedOrders: 0,
};

const earningsRows: EarningsRow[] = [
  {
    orderId: 'o1',
    orderNumber: 'ORD-001',
    customerName: 'Amel Ben Salah',
    establishmentName: null,
    line: 'cashStore',
    subtotal: 10,
    earned: 10,
    kind: 'NORMAL',
    commissionMoment: '2026-09-10T10:00:00.000Z',
    status: 'picked_up',
    refundReason: null,
  },
  {
    orderId: 'o2',
    orderNumber: 'ORD-002',
    customerName: 'Sami Trabelsi',
    establishmentName: null,
    line: 'cashDelivery',
    subtotal: 8,
    earned: 8,
    kind: 'NORMAL',
    commissionMoment: '2026-09-11T10:00:00.000Z',
    status: 'delivered',
    refundReason: null,
  },
  {
    orderId: 'o3',
    orderNumber: 'ORD-003',
    customerName: 'Rim Gharbi',
    establishmentName: null,
    line: 'online',
    subtotal: 12,
    earned: 12,
    kind: 'NORMAL',
    commissionMoment: '2026-09-12T10:00:00.000Z',
    status: 'completed',
    refundReason: null,
  },
];

const refundedRows: EarningsRow[] = [
  {
    orderId: 'r1',
    orderNumber: 'ORD-900',
    customerName: 'Foulen Ben Foulen',
    establishmentName: null,
    line: 'online',
    subtotal: 15,
    earned: 12.15,
    kind: 'NORMAL',
    commissionMoment: '2026-09-15T10:00:00.000Z',
    status: 'refunded',
    refundReason: 'Customer no-show',
  },
];

const verifyingRows: EarningsRow[] = [
  {
    orderId: 'v1',
    orderNumber: 'ORD-777',
    customerName: null,
    establishmentName: null,
    line: 'cashStore',
    subtotal: 20,
    earned: 0,
    kind: 'UNVERIFIED',
    commissionMoment: '2026-09-20T10:00:00.000Z',
    status: 'picked_up',
    refundReason: null,
  },
];

const rowsByTab: Record<EarningsTab, EarningsRowsPage> = {
  earnings: { rows: earningsRows, hasMore: false },
  refunded: { rows: refundedRows, hasMore: false },
  verifying: { rows: verifyingRows, hasMore: false },
};

interface StatsState {
  isLoading: boolean;
  isError: boolean;
  data: MerchantSalesSummary | undefined;
}
interface RowsState {
  isLoading: boolean;
  isError: boolean;
  page: EarningsRowsPage | null;
  hasNextPage: boolean;
}

let statsState: StatsState = { isLoading: false, isError: false, data: mockSummary };
let rowsState: RowsState = { isLoading: false, isError: false, page: null, hasNextPage: false };

jest.mock('@/hooks/use-payments', () => ({
  usePaymentStats: (p: string) => {
    statsSpy(p);
    return {
      data: statsState.data,
      isLoading: statsState.isLoading,
      isError: statsState.isError,
      refetch: statsRefetch,
    };
  },
  useMerchantEarningsRows: (p: string, tab: EarningsTab) => {
    rowsSpy(p, tab);
    const page = rowsState.page ?? rowsByTab[tab];
    return {
      data: rowsState.isLoading || rowsState.isError ? undefined : { pages: [page] },
      isLoading: rowsState.isLoading,
      isError: rowsState.isError,
      refetch: rowsRefetch,
      hasNextPage: rowsState.hasNextPage,
      isFetchingNextPage: false,
      fetchNextPage,
    };
  },
}));

function renderPage() {
  return render(
    <NextIntlClientProvider locale='en' messages={en}>
      <PaymentsPage />
    </NextIntlClientProvider>,
  );
}

describe('PaymentsPage', () => {
  beforeEach(() => {
    period = 'month';
    statsState = { isLoading: false, isError: false, data: mockSummary };
    rowsState = { isLoading: false, isError: false, page: null, hasNextPage: false };
    statsSpy.mockClear();
    rowsSpy.mockClear();
    statsRefetch.mockClear();
    rowsRefetch.mockClear();
    fetchNextPage.mockClear();
  });

  it('the fixture is internally consistent: the three earnings rows sum to the mocked total.earned', () => {
    const sum = earningsRows.reduce((s, r) => s + r.earned, 0);
    expect(sum).toBe(mockSummary.total.earned);
  });

  it('lists exactly the mocked Earnings rows on the default tab', () => {
    renderPage();
    for (const row of earningsRows) {
      expect(screen.getByText(`#${row.orderNumber}`)).toBeTruthy();
    }
    expect(screen.queryByText(`#${refundedRows[0]?.orderNumber}`)).toBeNull();
    expect(screen.getByRole('tab', { name: 'Earnings' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the stats card totals from the shared summary', () => {
    renderPage();
    expect(statsSpy).toHaveBeenLastCalledWith('month');
    expect(screen.getByText('Total earned')).toBeTruthy();
    expect(screen.getByText('Orders')).toBeTruthy();
  });

  it('switching to Refunded requests tab=refunded and shows the refund reason, not the earned amount', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Refunded' }));

    expect(rowsSpy).toHaveBeenLastCalledWith('month', 'refunded');
    expect(screen.getByText(`#${refundedRows[0]?.orderNumber}`)).toBeTruthy();
    expect(screen.getByText('Customer no-show')).toBeTruthy();
    expect(screen.queryByText(`#${earningsRows[0]?.orderNumber}`)).toBeNull();
  });

  it('switching to Being verified requests tab=verifying and shows the verification note', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Being verified' }));

    expect(rowsSpy).toHaveBeenLastCalledWith('month', 'verifying');
    expect(screen.getByText(`#${verifyingRows[0]?.orderNumber}`)).toBeTruthy();
    expect(screen.getByText('This sale is being verified and is not included yet.')).toBeTruthy();
  });

  it('changing the period requests period=7d for both the stats card and the row list', () => {
    renderPage();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '7 Days' }));
    });

    expect(statsSpy).toHaveBeenLastCalledWith('7d');
    expect(rowsSpy).toHaveBeenLastCalledWith('7d', 'earnings');
  });

  it('renders a loading state (skeletons, no content) for the stats card and the row list', () => {
    statsState = { isLoading: true, isError: false, data: undefined };
    rowsState = { isLoading: true, isError: false, page: null, hasNextPage: false };
    const { container } = renderPage();

    expect(screen.queryByText('Total earned')).toBeNull();
    expect(screen.queryByText(`#${earningsRows[0]?.orderNumber}`)).toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders an error state with retry for the stats card and the row list', () => {
    statsState = { isLoading: false, isError: true, data: undefined };
    rowsState = { isLoading: false, isError: true, page: null, hasNextPage: false };
    renderPage();

    const retryButtons = screen.getAllByRole('button', { name: 'Retry' });
    expect(retryButtons).toHaveLength(2);

    fireEvent.click(retryButtons[0] as HTMLElement);
    fireEvent.click(retryButtons[1] as HTMLElement);
    expect(statsRefetch).toHaveBeenCalledTimes(1);
    expect(rowsRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state when a tab has no rows', () => {
    rowsState = {
      isLoading: false,
      isError: false,
      page: { rows: [], hasMore: false },
      hasNextPage: false,
    };
    renderPage();

    expect(screen.getByText('No payments yet')).toBeTruthy();
  });

  it('shows Load more only when the current page has more, and pages on click', () => {
    rowsState = {
      isLoading: false,
      isError: false,
      page: { rows: earningsRows, hasMore: true, nextCursor: 'cursor-1' },
      hasNextPage: true,
    };
    renderPage();

    const loadMore = screen.getByRole('button', { name: 'Load more' });
    fireEvent.click(loadMore);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
