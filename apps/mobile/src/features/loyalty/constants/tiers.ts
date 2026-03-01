/**
 * Tier Configuration
 * Visual styling and thresholds for each loyalty tier.
 *
 * Thresholds sourced from backend loyalty.service.ts tier logic.
 */

import type { TierName } from '../types/loyalty.types';

export interface TierConfig {
  name: TierName;
  gradientStart: string;
  gradientEnd: string;
  textColor: string;
  /** Minimum lifetime points to reach this tier */
  minPoints: number;
  /** Points multiplier applied to bag purchases */
  multiplier: number;
  icon: string;
}

/**
 * Ordered tier configs — index 0 is lowest, 3 is highest.
 * Thresholds are approximate; the backend is the source of truth for tier assignment.
 */
export const TIER_CONFIGS: Record<TierName, TierConfig> = {
  Bronze: {
    name: 'Bronze',
    gradientStart: '#B87333',
    gradientEnd: '#CD7F32',
    textColor: '#FFFFFF',
    minPoints: 0,
    multiplier: 1.0,
    icon: 'shield-outline',
  },
  Silver: {
    name: 'Silver',
    gradientStart: '#C0C0C0',
    gradientEnd: '#E8E8E8',
    textColor: '#1F2937',
    minPoints: 400,
    multiplier: 1.2,
    icon: 'shield-half-outline',
  },
  Gold: {
    name: 'Gold',
    gradientStart: '#FFD700',
    gradientEnd: '#DAA520',
    textColor: '#1F2937',
    minPoints: 1200,
    multiplier: 1.5,
    icon: 'shield-checkmark-outline',
  },
  Platinum: {
    name: 'Platinum',
    gradientStart: '#1A1A2E',
    gradientEnd: '#16213E',
    textColor: '#FFFFFF',
    minPoints: 2700,
    multiplier: 2.0,
    icon: 'diamond-outline',
  },
};

/**
 * Get the tier config for a given tier name.
 * Falls back to Bronze if the name is unrecognised.
 */
export function getTierConfig(tier: TierName): TierConfig {
  return TIER_CONFIGS[tier] ?? TIER_CONFIGS.Bronze;
}

/**
 * Calculate progress (0..1) toward the next tier.
 * Returns 1 if the user is already at the highest tier (Platinum).
 */
export function getTierProgress(currentTier: TierName, lifetimePoints: number): number {
  const orderedTiers: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const currentIdx = orderedTiers.indexOf(currentTier);

  if (currentIdx >= orderedTiers.length - 1) {
    return 1; // Already Platinum
  }

  const currentMin = TIER_CONFIGS[currentTier].minPoints;
  const nextTier = orderedTiers[currentIdx + 1];
  if (nextTier === undefined) return 1;
  const nextMin = TIER_CONFIGS[nextTier].minPoints;

  const range = nextMin - currentMin;
  if (range <= 0) return 1;

  const progress = (lifetimePoints - currentMin) / range;
  return Math.min(Math.max(progress, 0), 1);
}

/**
 * Get the number of points remaining to reach the next tier.
 * Returns 0 if already at Platinum.
 */
export function getPointsToNextTier(currentTier: TierName, lifetimePoints: number): number {
  const orderedTiers: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const currentIdx = orderedTiers.indexOf(currentTier);

  if (currentIdx >= orderedTiers.length - 1) return 0;

  const nextTier = orderedTiers[currentIdx + 1];
  if (nextTier === undefined) return 0;
  const nextMin = TIER_CONFIGS[nextTier].minPoints;

  return Math.max(nextMin - lifetimePoints, 0);
}
