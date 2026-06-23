/**
 * useVotingPrize — Unit Tests
 *
 * Covers:
 *   - votingPrizeToClaimData adapter (pure function, no mocks needed)
 *   - useVotingPrizeStatus query hook (mocked service)
 *   - useClaimVotingPrize mutation hook (mocked service + cache invalidation)
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PrizeType } from '@foodwaste/shared';
import type { VotingPrizeStatusResponse } from '@foodwaste/shared';

// ─── Mock service ────────────────────────────────────────────────────────────

const mockGetMyPrize = jest.fn<Promise<VotingPrizeStatusResponse>, []>();
const mockClaimPrize = jest.fn<Promise<VotingPrizeStatusResponse>, [string]>();

jest.mock('../../services/votingPrizeService', () => ({
  votingPrizeService: {
    getMyPrize: () => mockGetMyPrize(),
    claimPrize: (id: string) => mockClaimPrize(id),
  },
}));

// Mock useQueryWithFocus to avoid @react-navigation/native focus dependency in tests.
jest.mock('@/lib/react-query', () => ({
  useQueryWithFocus: (
    key: readonly string[],
    fn: () => Promise<unknown>,
    opts?: { staleTime?: number; enabled?: boolean },
  ) => {
    const { useQuery } = jest.requireActual('@tanstack/react-query');
    return useQuery({ queryKey: key, queryFn: fn, ...opts });
  },
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  useVotingPrizeStatus,
  useClaimVotingPrize,
  votingPrizeToClaimData,
} from '../useVotingPrize';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_STATUS: VotingPrizeStatusResponse = {
  isWinner: true,
  rank: 2,
  recipientCount: 5,
  cycleId: 'c1',
  cycleName: 'Eco 3',
  prizeName: 'Smart Garden',
  hasClaimed: false,
  voucherCode: null,
  establishmentName: null,
  status: null,
};

const CLAIMED_STATUS: VotingPrizeStatusResponse = {
  ...BASE_STATUS,
  hasClaimed: true,
  voucherCode: 'TFW-ABC123',
  establishmentName: 'Green Cafe',
  status: 'pending',
};

// ─── votingPrizeToClaimData ──────────────────────────────────────────────────

describe('votingPrizeToClaimData', () => {
  it('returns null when not yet claimed', () => {
    expect(votingPrizeToClaimData(BASE_STATUS)).toBeNull();
  });

  it('returns null when hasClaimed is true but voucherCode is null', () => {
    expect(
      votingPrizeToClaimData({ ...BASE_STATUS, hasClaimed: true, voucherCode: null }),
    ).toBeNull();
  });

  it('maps a claimed status into a PrizeClaimResponse shape', () => {
    const result = votingPrizeToClaimData(CLAIMED_STATUS);
    expect(result).not.toBeNull();
    expect(result?.voucherCode).toBe('TFW-ABC123');
    expect(result?.establishmentName).toBe('Green Cafe');
    expect(result?.status).toBe('pending');
    expect(result?.prizeType).toBe(PrizeType.DISCOUNT);
    expect(result?.rank).toBe(2);
  });

  it('maps status field correctly for all valid values', () => {
    const statuses = ['pending', 'verified', 'delivered', 'rejected'] as const;
    for (const s of statuses) {
      const result = votingPrizeToClaimData({ ...CLAIMED_STATUS, status: s });
      expect(result?.status).toBe(s);
    }
  });

  it('uses cycleId as the id field', () => {
    const result = votingPrizeToClaimData(CLAIMED_STATUS);
    expect(result?.id).toBe('c1');
  });

  it('falls back to "voting" when cycleId is null', () => {
    const result = votingPrizeToClaimData({ ...CLAIMED_STATUS, cycleId: null });
    expect(result?.id).toBe('voting');
  });

  it('uses rank 0 when rank is null', () => {
    const result = votingPrizeToClaimData({ ...CLAIMED_STATUS, rank: null });
    expect(result?.rank).toBe(0);
  });

  it('does not include establishmentName when null', () => {
    const result = votingPrizeToClaimData({ ...CLAIMED_STATUS, establishmentName: null });
    expect(result).not.toBeNull();
    expect('establishmentName' in (result ?? {})).toBe(false);
  });
});

// ─── useVotingPrizeStatus ────────────────────────────────────────────────────

describe('useVotingPrizeStatus', () => {
  beforeEach(() => {
    mockGetMyPrize.mockReset();
  });

  it('fetches and returns winner data', async () => {
    mockGetMyPrize.mockResolvedValue(CLAIMED_STATUS);

    const { result } = renderHook(() => useVotingPrizeStatus(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(CLAIMED_STATUS);
    expect(result.current.error).toBeNull();
  });

  it('starts in loading state', () => {
    mockGetMyPrize.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useVotingPrizeStatus(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when enabled=false', () => {
    const { result } = renderHook(() => useVotingPrizeStatus(false), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockGetMyPrize).not.toHaveBeenCalled();
  });

  it('exposes error when fetch fails', async () => {
    mockGetMyPrize.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useVotingPrizeStatus(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});

// ─── useClaimVotingPrize ─────────────────────────────────────────────────────

describe('useClaimVotingPrize', () => {
  beforeEach(() => {
    mockClaimPrize.mockReset();
  });

  it('calls claimPrize with the given establishmentId', async () => {
    mockClaimPrize.mockResolvedValue(CLAIMED_STATUS);

    const { result } = renderHook(() => useClaimVotingPrize(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('est-001');
    });

    expect(mockClaimPrize).toHaveBeenCalledWith('est-001');
  });

  it('returns the claimed status on success', async () => {
    mockClaimPrize.mockResolvedValue(CLAIMED_STATUS);

    const { result } = renderHook(() => useClaimVotingPrize(), {
      wrapper: makeWrapper(),
    });

    let data: VotingPrizeStatusResponse | undefined;
    await act(async () => {
      data = await result.current.mutateAsync('est-001');
    });

    expect(data).toEqual(CLAIMED_STATUS);
  });

  it('invalidates the voting prize and cycle query keys on success', async () => {
    mockClaimPrize.mockResolvedValue(CLAIMED_STATUS);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useClaimVotingPrize(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('est-001');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['voting', 'myPrize'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['voting', 'cycle'] }),
    );
  });

  it('propagates mutation error', async () => {
    mockClaimPrize.mockRejectedValue(new Error('Already claimed'));

    const { result } = renderHook(() => useClaimVotingPrize(), {
      wrapper: makeWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync('est-001');
      }),
    ).rejects.toThrow('Already claimed');
  });
});
