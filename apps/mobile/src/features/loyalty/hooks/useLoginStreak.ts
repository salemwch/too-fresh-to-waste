/**
 * useLoginStreak Hook
 * Fire-and-forget: records a daily login on mount.
 * Silently awards streak points (2 pts/day, max 20/month).
 *
 * On success with pointsAwarded > 0, optimistically updates the
 * TanStack Query cache for instant UI feedback, then invalidates
 * both loyalty queries for eventual correctness.
 *
 * NOTE: Does NOT use AbortController — the POST is fire-and-forget,
 * so it must complete even if the screen unmounts during navigation.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { Logger } from '@/utils/logger';

import { loyaltyService } from '../services/loyaltyService';

import type { LoyaltyAccount, GamificationStats } from '../types/loyalty.types';

// Must match the keys in useLoyalty.ts — TanStack Query matches by value.
const LOYALTY_ACCOUNT_KEY = ['loyalty', 'account'] as const;
const GAMIFICATION_KEY = ['loyalty', 'gamification'] as const;

/**
 * Records a daily login streak on first mount.
 * Safe to call multiple times — the backend is idempotent per day.
 */
export function useLoginStreak(): void {
  const calledRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    // Fire-and-forget: no AbortController — the request must complete
    // even if the component unmounts (e.g., navigation transition).
    loyaltyService
      .recordLoginStreak()
      .then((result) => {
        if (result.pointsAwarded > 0) {
          Logger.info('[LoginStreak] Streak recorded', {
            streakDays: result.streakDays,
            pointsAwarded: result.pointsAwarded,
          });

          // --- Optimistic cache updates for instant UI feedback ---

          queryClient.setQueryData<LoyaltyAccount>(LOYALTY_ACCOUNT_KEY, (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              availablePoints: prev.availablePoints + result.pointsAwarded,
              totalPoints: prev.totalPoints + result.pointsAwarded,
              lifetimePointsEarned: prev.lifetimePointsEarned + result.pointsAwarded,
              loginStreak: {
                ...prev.loginStreak,
                currentStreak: result.streakDays,
                lastLoginDate: new Date().toISOString(),
                pointsEarnedThisMonth:
                  prev.loginStreak.pointsEarnedThisMonth + result.pointsAwarded,
              },
            };
          });

          queryClient.setQueryData<GamificationStats>(GAMIFICATION_KEY, (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              loginStreak: {
                ...prev.loginStreak,
                currentStreak: result.streakDays,
                pointsEarnedThisMonth:
                  prev.loginStreak.pointsEarnedThisMonth + result.pointsAwarded,
              },
            };
          });

          // Background refetch for eventual correctness
          void queryClient.invalidateQueries({ queryKey: LOYALTY_ACCOUNT_KEY });
          void queryClient.invalidateQueries({ queryKey: GAMIFICATION_KEY });
        } else {
          Logger.debug('[LoginStreak] Already logged in today', {
            streakDays: result.streakDays,
          });
        }
      })
      .catch((err) => {
        Logger.warn('[LoginStreak] Failed to record login streak', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [queryClient]);
}
