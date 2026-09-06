import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { dashboardKeys, useFundLedger } from '../use-merchant-dashboard';
import { dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/lib/auth';

import type { FundLedgerResponse } from '@/types/dashboard';
import type { ReactNode } from 'react';

/**
 * The backend-to-web seam for the fund ledger.
 *
 * Everything else on this path is mocked at a level that cannot see it: the
 * card test mocks `useFundLedger` wholesale, and the backend tests feed rows
 * to pure functions. This suite is the only thing that asserts the hook
 * unwraps the response envelope at the right depth, so a backend envelope
 * change, or a `.data` dropped or added here, fails a test instead of
 * rendering an empty state in production.
 */

jest.mock('@/services/dashboard.service', () => ({
  dashboardService: { getFundLedger: jest.fn() },
}));

const mockGetFundLedger = dashboardService.getFundLedger as jest.MockedFunction<
  typeof dashboardService.getFundLedger
>;

const LEDGER: FundLedgerResponse = {
  totalTnd: 47.35,
  currency: 'TND',
  contributionCount: 12,
  items: [{ category: 'TSHIRTS', count: 3, amountTnd: 35 }],
  totalItems: 3,
  firstContributionAt: '2026-03-01T00:00:00.000Z',
};

/** The full axios-shaped response the real client returns. */
function envelope(data: FundLedgerResponse) {
  return {
    // axios response.data is the backend envelope; the payload is one level
    // further in, under its `data` key.
    data: {
      status: 200,
      message: 'Fund ledger retrieved successfully',
      data,
      timestamp: '2026-09-05T00:00:00.000Z',
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  } as unknown as Awaited<ReturnType<typeof dashboardService.getFundLedger>>;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useFundLedger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ activeEstablishmentId: null });
  });

  it('unwraps the payload from response.data.data, not response.data', async () => {
    mockGetFundLedger.mockResolvedValue(envelope(LEDGER));

    const { result } = renderHook(() => useFundLedger(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Exact equality, not a field probe. Unwrapping one level too shallow
    // would hand the card the whole envelope - `data.totalTnd` would be
    // undefined, `data.contributionCount === 0` would be false, and the card
    // would render "undefined TND" rather than an empty state or an error.
    expect(result.current.data).toEqual(LEDGER);
    expect(result.current.data).not.toHaveProperty('status');
    expect(result.current.data).not.toHaveProperty('message');
    expect(result.current.data?.totalTnd).toBe(47.35);
  });

  it('passes the active establishment through to the service and into the query key', async () => {
    const ESTABLISHMENT_ID = 'est-123';
    useAuthStore.setState({ activeEstablishmentId: ESTABLISHMENT_ID });
    mockGetFundLedger.mockResolvedValue(envelope(LEDGER));

    const { result } = renderHook(() => useFundLedger(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetFundLedger).toHaveBeenCalledWith(ESTABLISHMENT_ID);
    // Two establishments must not share a cache entry.
    expect(dashboardKeys.fundLedger(ESTABLISHMENT_ID)).not.toEqual(
      dashboardKeys.fundLedger(undefined),
    );
  });

  it('sends no establishmentId when none is selected', async () => {
    mockGetFundLedger.mockResolvedValue(envelope(LEDGER));

    const { result } = renderHook(() => useFundLedger(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetFundLedger).toHaveBeenCalledWith(undefined);
  });

  it('surfaces a failed request as isError, with no partial data', async () => {
    // The card renders a translated message off isError. If a rejection
    // resolved to undefined data instead, it would render the empty state -
    // "your first sale starts this" - to a merchant whose request just failed.
    mockGetFundLedger.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useFundLedger(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('keeps the response fresh for 5 minutes so a refocus does not refetch', async () => {
    // .claude/rules/performance.md rule 4: the ledger only changes when an
    // order completes.
    mockGetFundLedger.mockResolvedValue(envelope(LEDGER));

    const { result, rerender } = renderHook(() => useFundLedger(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    rerender();

    expect(mockGetFundLedger).toHaveBeenCalledTimes(1);
    expect(result.current.isStale).toBe(false);
  });
});
