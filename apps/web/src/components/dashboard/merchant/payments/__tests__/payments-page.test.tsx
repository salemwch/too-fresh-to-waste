import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import ar from '../../../../../messages/ar.json';
import en from '../../../../../messages/en.json';
import fr from '../../../../../messages/fr.json';
import { dashboardKeys } from '@/hooks/use-merchant-dashboard';
import { formatMoney } from '@/lib/format';
import { dashboardService } from '@/services/dashboard.service';
import { paymentsService } from '@/services/payments.service';
import { PaymentsPage } from '../payments-page';
import type {
  EarningsRow,
  EarningsRowsPage,
  EarningsTab,
  MerchantSalesSummary,
} from '@/types/payments';
import type { MerchantWallet } from '@/types/dashboard';

/**
 * The Payments tab reads two things from the shared earnings calculation:
 * the stats card (`usePaymentStats`) and the per-tab row list
 * (`useMerchantEarningsRows`). This suite mocks only the service layer
 * (`paymentsService`), not the hooks - the real `useQuery`/`useInfiniteQuery`
 * run under a real `QueryClientProvider`, so the query key (period + tab),
 * the request params sent to the service, and `getNextPageParam` are all
 * actually exercised. Mocking the hooks directly (round 1 of this test) hid
 * all of that and let a wrong field (`subtotal` instead of `earned`) pass,
 * because every fixture happened to have `subtotal === earned`. Fixtures
 * below deliberately differ (a NORMAL row at 81%, a SETTLEMENT row earning
 * far less than its subtotal) so rendering the wrong field would fail.
 *
 * The calculation itself is covered by merchant-sales.integration.spec.ts on
 * the backend; this suite is only the page's own logic.
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

jest.mock('@/services/payments.service', () => ({
  paymentsService: { getStats: jest.fn(), getMyPayments: jest.fn() },
}));

// `HeldBalanceCard` reads `useMyWallet()`, which calls this service directly -
// mocked here (not the hook) for the same reason as `paymentsService` above:
// the real `useQuery` must actually run, so a wrong query key or a period
// leaking into it would be caught rather than hidden by a hook-level mock.
jest.mock('@/services/dashboard.service', () => ({
  dashboardService: { getMyWallet: jest.fn() },
}));

const mockGetStats = paymentsService.getStats as jest.MockedFunction<
  typeof paymentsService.getStats
>;
const mockGetMyPayments = paymentsService.getMyPayments as jest.MockedFunction<
  typeof paymentsService.getMyPayments
>;
const mockGetMyWallet = dashboardService.getMyWallet as jest.MockedFunction<
  typeof dashboardService.getMyWallet
>;

// `formatMoney` renders with a non-breaking space (`TND 21.600`).
// RTL's default normalizer collapses the DOM's whitespace (including NBSP) to
// a plain space before comparing, but does not normalize the string passed
// to `getByText` - so the two must be normalized the same way here too, or
// every assertion below silently fails to find text that is actually on screen.
const money = (v: number) => formatMoney('en', v).replace(/\s+/g, ' ').trim();

function statsEnvelope(data: MerchantSalesSummary) {
  return { data: { data } } as unknown as Awaited<ReturnType<typeof paymentsService.getStats>>;
}
function rowsEnvelope(data: EarningsRowsPage) {
  return { data: { data } } as unknown as Awaited<ReturnType<typeof paymentsService.getMyPayments>>;
}
function walletEnvelope(data: MerchantWallet) {
  return { data: { data } } as unknown as Awaited<ReturnType<typeof dashboardService.getMyWallet>>;
}

const mockWallet: MerchantWallet = { availableBalance: 310, pendingBalance: 96, currency: 'TND' };

// Deliberately subtotal !== earned everywhere, and total.foodValue !== total.earned,
// so rendering the wrong field fails instead of passing by coincidence.
const mockSummary: MerchantSalesSummary = {
  period: 'month',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-09-27T00:00:00.000Z',
  currency: 'TND',
  total: { orders: 3, earned: 21.6, foodValue: 36, originalValue: 38 },
  channels: {
    cashStore: { orders: 1, earned: 8.1 },
    cashDelivery: { orders: 1, earned: 4 },
    online: { orders: 1, earned: 9.5 },
  },
  commission: { rate: 0.19, accrued: 3.99, settled: 6 },
  unverifiedOrders: 0,
};

const earningsRows: EarningsRow[] = [
  {
    orderId: 'o1',
    orderNumber: 'ORD-001',
    customerName: 'Amel Ben Salah',
    establishmentName: null,
    line: 'cashStore',
    subtotal: 10, // 81% of 10 = 8.1
    earned: 8.1,
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
    subtotal: 12, // SETTLEMENT: merchant earns far less than the subtotal
    earned: 4,
    kind: 'SETTLEMENT',
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
    subtotal: 14,
    earned: 9.5,
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

const MESSAGES = { en, fr, ar } as const;

function renderPage(locale: keyof typeof MESSAGES = 'en') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        <PaymentsPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe('PaymentsPage', () => {
  beforeEach(() => {
    period = 'month';
    jest.clearAllMocks();
    mockGetStats.mockResolvedValue(statsEnvelope(mockSummary));
    mockGetMyPayments.mockImplementation(params =>
      Promise.resolve(rowsEnvelope(rowsByTab[params.tab])),
    );
    mockGetMyWallet.mockResolvedValue(walletEnvelope(mockWallet));
  });

  it('shows the stats card totals from the shared summary - the real earned amount, never the subtotal or foodValue', async () => {
    renderPage();
    await screen.findByText(money(21.6)); // stats.totalEarned appears once resolved

    // Scoped to each stat card: one Earnings row happens to be the only
    // order on its channel, so its label and `earned` legitimately equal
    // that channel's label and total - an unscoped query would find both
    // the stat card's <p> label and the row's <span> line label and throw.
    // `selector: 'p'` picks the stat card's label specifically.
    const statCard = (label: string) =>
      screen.getByText(label, { selector: 'p' }).closest('.glass') as HTMLElement;
    expect(within(statCard('Total earned')).getByText(money(21.6))).toBeTruthy();
    expect(within(statCard('Orders')).getByText('3')).toBeTruthy();
    expect(within(statCard('Cash collected in store')).getByText(money(8.1))).toBeTruthy();
    expect(within(statCard('Cash collected via delivery')).getByText(money(4))).toBeTruthy();
    expect(within(statCard('Paid online')).getByText(money(9.5))).toBeTruthy();

    // The food value (36) is a real, different number - must never appear as if it were earnings.
    expect(screen.queryByText(money(36))).toBeNull();
    expect(screen.queryByText(money(38))).toBeNull();

    expect(mockGetStats).toHaveBeenCalledWith('month');
  });

  it('lists exactly the mocked Earnings rows, showing `earned` (never `subtotal`) per row', async () => {
    renderPage();

    // Scoped to each row card, not the whole screen: the stats card above
    // also shows 8.1/4/9.5 (the channel totals), so an unscoped query would
    // pass even if the row itself rendered nothing.
    for (const row of earningsRows) {
      const heading = await screen.findByText(`#${row.orderNumber}`);
      const card = heading.closest('.glass') as HTMLElement;
      expect(within(card).getByText(money(row.earned))).toBeTruthy();
      expect(within(card).queryByText(money(row.subtotal))).toBeNull();
    }

    expect(screen.queryByText(`#${refundedRows[0]?.orderNumber}`)).toBeNull();
    expect(screen.getByRole('tab', { name: 'Earnings' })).toHaveAttribute('aria-selected', 'true');
    // The hook itself sends only period/tab/after; the default `limit` is
    // applied one layer down, inside the real (here mocked-away) service.
    expect(mockGetMyPayments).toHaveBeenCalledWith(
      expect.objectContaining({ period: 'month', tab: 'earnings' }),
    );
  });

  it('switching to Refunded requests tab=refunded and shows the refund reason, not the earned amount', async () => {
    renderPage();
    await screen.findByText(`#${earningsRows[0]?.orderNumber}`);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Refunded' }), { button: 0 });

    expect(await screen.findByText(`#${refundedRows[0]?.orderNumber}`)).toBeTruthy();
    expect(screen.getByText('Customer no-show')).toBeTruthy();
    expect(screen.queryByText(`#${earningsRows[0]?.orderNumber}`)).toBeNull();
    // The refunded row's earned/subtotal amounts are not rendered as a figure on this tab.
    expect(screen.queryByText(money(refundedRows[0]?.earned ?? 0))).toBeNull();
    expect(screen.queryByText(money(refundedRows[0]?.subtotal ?? 0))).toBeNull();

    await waitFor(() => {
      expect(mockGetMyPayments).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'month', tab: 'refunded' }),
      );
    });
  });

  it('switching to Being verified requests tab=verifying and shows the verification note', async () => {
    renderPage();
    await screen.findByText(`#${earningsRows[0]?.orderNumber}`);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Being verified' }), { button: 0 });

    expect(await screen.findByText(`#${verifyingRows[0]?.orderNumber}`)).toBeTruthy();
    expect(screen.getByText('This sale is being verified and is not included yet.')).toBeTruthy();

    await waitFor(() => {
      expect(mockGetMyPayments).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'month', tab: 'verifying' }),
      );
    });
  });

  it('changing the period requests period=7d for both the stats card and the row list', async () => {
    renderPage();
    await screen.findByText(`#${earningsRows[0]?.orderNumber}`);

    fireEvent.click(screen.getByRole('button', { name: '7 Days' }));

    await waitFor(() => {
      expect(mockGetStats).toHaveBeenLastCalledWith('7d');
    });
    await waitFor(() => {
      expect(mockGetMyPayments).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: '7d', tab: 'earnings' }),
      );
    });
  });

  it('renders a loading state (skeletons, no content) for the stats card and the row list', () => {
    mockGetStats.mockImplementation(() => new Promise(() => undefined));
    mockGetMyPayments.mockImplementation(() => new Promise(() => undefined));
    const { container } = renderPage();

    expect(screen.queryByText('Total earned')).toBeNull();
    expect(screen.queryByText(`#${earningsRows[0]?.orderNumber}`)).toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders an error state with independent retry for the stats card and the row list', async () => {
    mockGetStats.mockRejectedValue(new Error('stats failed'));
    mockGetMyPayments.mockRejectedValue(new Error('rows failed'));
    renderPage();

    const retryButtons = await screen.findAllByRole('button', { name: 'Retry' });
    expect(retryButtons).toHaveLength(2);

    mockGetStats.mockClear();
    mockGetMyPayments.mockClear();
    mockGetStats.mockResolvedValue(statsEnvelope(mockSummary));
    mockGetMyPayments.mockImplementation(params =>
      Promise.resolve(rowsEnvelope(rowsByTab[params.tab])),
    );

    fireEvent.click(retryButtons[0] as HTMLElement);
    fireEvent.click(retryButtons[1] as HTMLElement);

    await waitFor(() => expect(mockGetStats).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockGetMyPayments).toHaveBeenCalledTimes(1));
  });

  it('renders a tab-specific empty state when a tab has no rows', async () => {
    mockGetMyPayments.mockResolvedValue(rowsEnvelope({ rows: [], hasMore: false }));
    renderPage();

    expect(await screen.findByText('No sales in this period yet.')).toBeTruthy();
  });

  it('shows Load more only when the current page has more, and pages with the cursor on click', async () => {
    mockGetMyPayments.mockImplementation(params =>
      Promise.resolve(
        rowsEnvelope(
          params.after
            ? { rows: [], hasMore: false }
            : { rows: earningsRows, hasMore: true, nextCursor: 'cursor-1' },
        ),
      ),
    );
    renderPage();

    const loadMore = await screen.findByRole('button', { name: 'Load more' });
    fireEvent.click(loadMore);

    await waitFor(() => {
      expect(mockGetMyPayments).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'month', tab: 'earnings', after: 'cursor-1' }),
      );
    });
  });

  // ─── HeldBalanceCard (task-15b: the live balance moved here from the
  // Dashboard) - service-layer mocked exactly like the rest of this suite, so
  // the real `useMyWallet()` query actually runs. ────────────────────────────

  describe('the held balance at the top of the page', () => {
    it('renders both figures, formatted with the wallet currency', async () => {
      renderPage();

      const heading = await screen.findByText('Money TFTW currently holds');
      const card = heading.closest('.glass') as HTMLElement;
      expect(within(card).getByText(money(310))).toBeTruthy();
      expect(within(card).getByText(money(96))).toBeTruthy();
      expect(within(card).getByText('Available for payout')).toBeTruthy();
      expect(within(card).getByText('Awaiting pickup')).toBeTruthy();
    });

    it('shows a skeleton, not a loading text, while the wallet is loading', () => {
      mockGetMyWallet.mockImplementation(() => new Promise(() => undefined));
      renderPage();

      expect(screen.getByTestId('held-balance-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('Money TFTW currently holds')).toBeNull();
    });

    it('shows the error message with a Retry that calls the service again', async () => {
      mockGetMyWallet.mockRejectedValue(new Error('wallet failed'));
      renderPage();

      const retry = await screen.findByRole('button', { name: 'Retry' });
      expect(screen.getByText('Could not load the balance TFTW holds.')).toBeInTheDocument();
      expect(mockGetMyWallet).toHaveBeenCalledTimes(1);

      mockGetMyWallet.mockResolvedValue(walletEnvelope(mockWallet));
      fireEvent.click(retry);

      await waitFor(() => expect(mockGetMyWallet).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(money(310))).toBeTruthy();
    });

    it('keeps the balance already on screen when a background refetch fails', async () => {
      const { queryClient } = renderPage();
      await screen.findByText(money(310));

      // A period change never refetches the wallet (covered separately below),
      // so the background refetch has to be forced directly - the same
      // TanStack mechanism a focus/reconnect refetch would trigger for real.
      mockGetMyWallet.mockRejectedValueOnce(new Error('background refetch failed'));
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: dashboardKeys.myWallet(undefined) });
      });

      expect(screen.getByText(money(310))).toBeInTheDocument();
      expect(screen.queryByText('Could not load the balance TFTW holds.')).toBeNull();
    });

    it('never refetches the wallet on a period change, while the stats do', async () => {
      renderPage();
      await screen.findByText(money(310));
      expect(mockGetMyWallet).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: '7 Days' }));
      await waitFor(() => expect(mockGetStats).toHaveBeenLastCalledWith('7d'));

      fireEvent.click(screen.getByRole('button', { name: '30 Days' }));
      await waitFor(() => expect(mockGetStats).toHaveBeenLastCalledWith('30d'));

      expect(mockGetMyWallet).toHaveBeenCalledTimes(1);
      expect(mockGetMyWallet).toHaveBeenCalledWith(undefined);
    });

    it('renders a real zero balance as 0.000, not a dash or a blank figure', async () => {
      mockGetMyWallet.mockResolvedValue(
        walletEnvelope({ availableBalance: 0, pendingBalance: 0, currency: 'TND' }),
      );
      renderPage();

      const heading = await screen.findByText('Money TFTW currently holds');
      const card = heading.closest('.glass') as HTMLElement;
      const zeroFigures = within(card).getAllByText(money(0));
      expect(zeroFigures).toHaveLength(2);
    });

    it.each(['fr', 'ar'] as const)('renders the translated title and note in %s', async locale => {
      renderPage(locale);

      const expected = {
        fr: {
          title: 'Argent détenu actuellement par TFTW',
          note: 'Votre solde à cet instant. Il ne dépend pas de la période choisie.',
        },
        ar: {
          title: 'الأموال التي تحتفظ بها TFTW حاليًا',
          note: 'رصيدك في هذه اللحظة. لا يتغيّر بتغيّر الفترة المختارة.',
        },
      }[locale];

      expect(await screen.findByText(expected.title)).toBeInTheDocument();
      expect(screen.getByText(expected.note)).toBeInTheDocument();
    });
  });
});
