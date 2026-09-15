/**
 * The last mile: an establishment filter must actually narrow the offers.
 *
 * `categoryFilter.integration.test.tsx` proves a tap reaches all four query
 * hooks with the right `establishmentTypes`. It stops at the hook boundary.
 * This file covers what happens *inside* the hooks — where the filter is either
 * sent to the API or quietly dropped.
 *
 * WHAT IT CAUGHT
 * --------------
 * Three of the four home carousels ignored the filter entirely. `urgent`,
 * `pickupToday` and `pickupTomorrow` handed it to `applyClientSideFilters`,
 * which logged
 *
 *     'Establishment/cuisine filtering not fully supported…'
 *
 * and returned the list untouched, while their service methods took no filter
 * argument at all. Tapping a category refetched them — `filterParams` is in
 * every query key — and returned the same offers. A refetch is not a filter,
 * and on a device the two are indistinguishable.
 *
 * FIXED SERVER-SIDE, NOT IN JS
 * ----------------------------
 * `OfferListItem` carries no establishment type, so there is nothing to match
 * on client-side; and the rows arrive already cut to `limit`, so filtering
 * afterwards would show 0 bakeries while bakery offers sat unfetched past the
 * limit. The three endpoints now accept `establishmentTypes`, and
 * `/offers/urgent` folds it into its shared cache key through
 * `resolveEstablishmentTypeFilter`.
 *
 * These assert the whole contract: the filter reaches the service for every
 * carousel, and is omitted entirely when absent.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { EstablishmentType, OfferStatus } from '@/features/offers/types/offer.types';

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** One offer from a bakery and one from a cafe — the type lives on neither. */
const mockOffers = [
  { id: 'o1', title: 'Pain', establishment: { name: 'Boulangerie' } },
  { id: 'o2', title: 'Latte', establishment: { name: 'Cafe' } },
];

const mockCalls: Record<string, unknown> = {};

jest.mock('../../services/offersService', () => ({
  offersService: {
    getAllOffers: jest.fn((params: unknown) => {
      mockCalls['getAllOffers'] = params;
      return Promise.resolve({ data: [], meta: {} });
    }),
    getUrgentOffers: jest.fn((...a: unknown[]) => {
      mockCalls['getUrgentOffers'] = a;
      return Promise.resolve(mockOffers);
    }),
    getPickupTodayOffers: jest.fn((...a: unknown[]) => {
      mockCalls['getPickupTodayOffers'] = a;
      return Promise.resolve(mockOffers);
    }),
    getPickupTomorrowOffers: jest.fn((...a: unknown[]) => {
      mockCalls['getPickupTomorrowOffers'] = a;
      return Promise.resolve(mockOffers);
    }),
  },
}));

import {
  useOffers,
  useUrgentOffers,
  usePickupTodayOffers,
  usePickupTomorrowOffers,
} from '../useOffers';

const BAKERY_FILTER = {
  establishmentTypes: [EstablishmentType.BAKERY, EstablishmentType.PASTRY_SHOP],
};

/*
 * Built once per test in `beforeEach`, never inside `wrapper`.
 *
 * Creating the client inside the wrapper makes a NEW QueryClient on every
 * render, which changes the provider value every render and re-renders
 * forever — the suite hangs rather than fails, so the cause is not obvious
 * from the output.
 */
let client: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockCalls)) delete mockCalls[k];
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(() => {
  // Cancels anything in flight; a live client keeps timers open across suites.
  client.clear();
});

// ============================================================================
// The one that works
// ============================================================================

describe('hottest deals (useOffers)', () => {
  it('sends establishmentTypes to the API, so the backend filters', async () => {
    renderHook(() => useOffers({ status: OfferStatus.ACTIVE, ...BAKERY_FILTER }, undefined), {
      wrapper,
    });

    await waitFor(() => {
      expect(mockCalls['getAllOffers']).toBeDefined();
    });

    expect(mockCalls['getAllOffers']).toEqual(
      expect.objectContaining({ establishmentTypes: BAKERY_FILTER.establishmentTypes }),
    );
  });
});

// ============================================================================
// The three that do not — asserted as the requirement, marked failing
// ============================================================================

describe('the other three carousels now send the establishment filter', () => {
  it('urgent sends the filter to the service', async () => {
    renderHook(() => useUrgentOffers(2, 10, undefined, BAKERY_FILTER), { wrapper });

    await waitFor(() => {
      expect(mockCalls['getUrgentOffers']).toBeDefined();
    });

    const args = mockCalls['getUrgentOffers'] as unknown[];
    expect(args[4]).toEqual(BAKERY_FILTER.establishmentTypes);
  });

  it('urgent omits the filter entirely when none is set', async () => {
    // An empty array would still key a distinct cache entry server-side.
    renderHook(() => useUrgentOffers(2, 10, undefined, undefined), { wrapper });

    await waitFor(() => {
      expect(mockCalls['getUrgentOffers']).toBeDefined();
    });

    expect((mockCalls['getUrgentOffers'] as unknown[])[4]).toBeUndefined();
  });

  it('pickup today sends the filter to the service', async () => {
    renderHook(() => usePickupTodayOffers(20, undefined, BAKERY_FILTER), { wrapper });

    await waitFor(() => {
      expect(mockCalls['getPickupTodayOffers']).toBeDefined();
    });

    expect((mockCalls['getPickupTodayOffers'] as unknown[])[4]).toEqual(
      BAKERY_FILTER.establishmentTypes,
    );
  });

  it('pickup tomorrow sends the filter to the service', async () => {
    renderHook(() => usePickupTomorrowOffers(20, undefined, BAKERY_FILTER), { wrapper });

    await waitFor(() => {
      expect(mockCalls['getPickupTomorrowOffers']).toBeDefined();
    });

    expect((mockCalls['getPickupTomorrowOffers'] as unknown[])[4]).toEqual(
      BAKERY_FILTER.establishmentTypes,
    );
  });

  it('still applies the filters it DOES support, so this is not a dead path', async () => {
    // `categories` is handled client-side and must keep working — otherwise a
    // future fix could "solve" this by deleting applyClientSideFilters.
    const withCategories = [
      { id: 'o1', title: 'Pain', categories: ['bakery'], establishment: { name: 'B' } },
      { id: 'o2', title: 'Latte', categories: ['drinks'], establishment: { name: 'C' } },
    ];
    const svc = jest.requireMock('../../services/offersService') as {
      offersService: { getUrgentOffers: jest.Mock };
    };
    svc.offersService.getUrgentOffers.mockResolvedValueOnce(withCategories);

    const { result } = renderHook(
      () => useUrgentOffers(2, 10, undefined, { categories: ['bakery'] }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.id).toBe('o1');
  });
});
