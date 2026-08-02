/**
 * useLoyalty Hook
 * Fetches loyalty account + gamification stats with screen-focus refetch.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { Freshness } from '@/lib/react-query/freshness';
import { useQueryWithFocus } from '@/lib/react-query';

import { loyaltyService } from '../services/loyaltyService';

import type { LoyaltyAccount, GamificationStats } from '../types/loyalty.types';

const LOYALTY_ACCOUNT_KEY = ['loyalty', 'account'] as const;
const GAMIFICATION_KEY = ['loyalty', 'gamification'] as const;

export function useLoyalty() {
  const queryClient = useQueryClient();

  const accountQuery = useQueryWithFocus<LoyaltyAccount, Error>(
    LOYALTY_ACCOUNT_KEY,
    () => loyaltyService.getAccount(),
    {
      staleTime: Freshness.SHORT,
      gcTime: 1000 * 60 * 30, // 30 min
    },
  );

  const gamificationQuery = useQueryWithFocus<GamificationStats, Error>(
    GAMIFICATION_KEY,
    () => loyaltyService.getGamification(),
    {
      staleTime: Freshness.SHORT,
      gcTime: 1000 * 60 * 30,
    },
  );

  const refetch = useCallback(async () => {
    await Promise.all([accountQuery.refetch(), gamificationQuery.refetch()]);
  }, [accountQuery, gamificationQuery]);

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: LOYALTY_ACCOUNT_KEY }),
      queryClient.invalidateQueries({ queryKey: GAMIFICATION_KEY }),
    ]);
  }, [queryClient]);

  return {
    account: accountQuery.data,
    gamification: gamificationQuery.data,
    isLoading: accountQuery.isLoading || gamificationQuery.isLoading,
    isRefetching: accountQuery.isRefetching || gamificationQuery.isRefetching,
    error: accountQuery.error ?? gamificationQuery.error,
    refetch,
    invalidate,
  };
}
