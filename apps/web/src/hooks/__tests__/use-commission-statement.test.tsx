import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { dashboardKeys, useCommissionStatement } from '../use-merchant-dashboard';
import { dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/lib/auth';

import type { MerchantCommissionStatement } from '@/types/dashboard';
import type { ReactNode } from 'react';

/**
 * The commission card under "All locations".
 *
 * The hook used to be `enabled: !!activeEstablishmentId`. With All locations
 * selected that is `false`, and a disabled TanStack query reports `isPending`
 * forever - so the card sat on its skeleton and never showed a figure. This
 * suite asserts the query actually runs with no establishment selected, and
 * asks for the all-locations statement rather than a per-location one.
 */

jest.mock('@/services/dashboard.service', () => ({
  dashboardService: { getMyCommission: jest.fn() },
}));

const mockGetMyCommission = dashboardService.getMyCommission as jest.MockedFunction<
  typeof dashboardService.getMyCommission
>;

const STATEMENT: MerchantCommissionStatement = {
  commissionDue: 4.75,
  dueByEstablishment: [
    { establishmentId: 'est-big', name: 'Big', amount: 3.8 },
    { establishmentId: 'est-small', name: 'Small', amount: 0.95 },
  ],
  sales: 35,
  commission: 6.65,
  received: 28.35,
  rate: 0.19,
  fullPriceOrders: 3,
  settledOrders: 0,
  currency: 'TND',
  recentSettlements: [],
};

function envelope(data: MerchantCommissionStatement) {
  return {
    data: {
      status: 200,
      message: 'Commission statement retrieved successfully',
      data,
      timestamp: '2026-09-24T00:00:00.000Z',
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  } as unknown as Awaited<ReturnType<typeof dashboardService.getMyCommission>>;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useCommissionStatement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ activeEstablishmentId: null });
  });

  it('runs under "All locations" instead of waiting forever', async () => {
    mockGetMyCommission.mockResolvedValue(envelope(STATEMENT));

    const { result } = renderHook(() => useCommissionStatement(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // No id: the service calls the all-locations route.
    expect(mockGetMyCommission).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(STATEMENT);
  });

  it('asks for one establishment when one is selected', async () => {
    useAuthStore.setState({ activeEstablishmentId: 'est-123' });
    mockGetMyCommission.mockResolvedValue(envelope(STATEMENT));

    const { result } = renderHook(() => useCommissionStatement(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetMyCommission).toHaveBeenCalledWith('est-123');
  });

  it('keeps the all-locations and per-location statements in separate cache entries', () => {
    expect(dashboardKeys.commissionStatement(undefined)).not.toEqual(
      dashboardKeys.commissionStatement('est-123'),
    );
  });

  it('surfaces a failed request as an error, not as endless loading', async () => {
    mockGetMyCommission.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useCommissionStatement(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
