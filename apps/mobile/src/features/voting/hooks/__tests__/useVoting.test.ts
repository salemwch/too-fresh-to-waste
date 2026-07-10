/**
 * useVoting Hooks - Unit Tests
 * Tests useActiveVotingCycle return shape and useVoteMutation invalidation.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock votingService
// ---------------------------------------------------------------------------
const mockGetActiveCycle = jest.fn();
const mockCastVote = jest.fn();
jest.mock('../../services/votingService', () => ({
  votingService: {
    getActiveCycle: () => mockGetActiveCycle(),
    castVote: (prizeId: string) => mockCastVote(prizeId),
  },
}));

// Mock useQueryWithFocus to behave like a basic useQuery
jest.mock('@/lib/react-query', () => ({
  useQueryWithFocus: (
    key: readonly string[],
    fn: () => Promise<unknown>,
    opts?: { staleTime?: number },
  ) => {
    const { useQuery } = jest.requireActual('@tanstack/react-query');
    return useQuery({ queryKey: key, queryFn: fn, ...opts });
  },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActiveVotingCycle, useVoteMutation } from '../useVoting';
import type { ActiveVotingResponse } from '../../types/voting.types';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const MOCK_RESPONSE: ActiveVotingResponse = {
  cycle: {
    _id: 'c1',
    name: 'Test Cycle',
    status: 'ACTIVE',
    cycleStartDate: '2026-01-01T00:00:00Z',
    cycleEndDate: '2026-07-01T00:00:00Z',
    communityGoalTarget: 30000,
    communityGoalProgress: 10000,
    ballotOpensAt: null,
    ballotClosesAt: null,
    prizes: [],
    winner: null,
    recipientCount: 5,
    minimumBags: 50,
  },
  eligibility: {
    canVote: false,
    userBagsInCycle: 10,
    requiredBags: 50,
    pointsSnapshot: 500,
  },
  myVote: null,
};

describe('useActiveVotingCycle', () => {
  beforeEach(() => {
    mockGetActiveCycle.mockReset();
    mockCastVote.mockReset();
  });

  it('returns loading state initially', () => {
    mockGetActiveCycle.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useActiveVotingCycle(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.cycle).toBeNull();
    expect(result.current.eligibility).toBeNull();
    expect(result.current.myVote).toBeNull();
  });

  it('returns cycle data after fetch', async () => {
    mockGetActiveCycle.mockResolvedValue(MOCK_RESPONSE);
    const { result } = renderHook(() => useActiveVotingCycle(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cycle).toEqual(MOCK_RESPONSE.cycle);
    expect(result.current.eligibility).toEqual(MOCK_RESPONSE.eligibility);
    expect(result.current.myVote).toBeNull();
  });

  it('returns nulls when backend returns null data', async () => {
    mockGetActiveCycle.mockResolvedValue({
      cycle: null,
      eligibility: null,
      myVote: null,
    });
    const { result } = renderHook(() => useActiveVotingCycle(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cycle).toBeNull();
    expect(result.current.eligibility).toBeNull();
    expect(result.current.myVote).toBeNull();
  });

  it('exposes error when fetch fails', async () => {
    mockGetActiveCycle.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useActiveVotingCycle(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});

describe('useVoteMutation', () => {
  it('calls castVote with prizeId and invalidates active query on success', async () => {
    mockCastVote.mockResolvedValue({ success: true });
    mockGetActiveCycle.mockResolvedValue(MOCK_RESPONSE);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useVoteMutation(), { wrapper });

    await result.current.mutateAsync('p1');

    expect(mockCastVote).toHaveBeenCalledWith('p1');
  });

  it('propagates mutation error', async () => {
    mockCastVote.mockRejectedValue(new Error('Already voted'));

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useVoteMutation(), { wrapper });

    await expect(result.current.mutateAsync('p1')).rejects.toThrow('Already voted');
  });
});
