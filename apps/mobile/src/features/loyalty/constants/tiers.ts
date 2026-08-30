/**
 * Tier Configuration
 * Visual styling and thresholds for each loyalty tier.
 *
 * Thresholds sourced from backend loyalty.service.ts tier logic.
 */

import type { TierName } from '../types/loyalty.types';

import { colorTokens } from '@/design-system/tokens/colors';

interface TierConfig {
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
const TIER_CONFIGS: Record<TierName, TierConfig> = {
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
    textColor: colorTokens.base.neutral[900],
    minPoints: 400,
    multiplier: 1.2,
    icon: 'shield-half-outline',
  },
  Gold: {
    name: 'Gold',
    gradientStart: '#FFD700',
    gradientEnd: '#DAA520',
    textColor: colorTokens.base.neutral[900],
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

/** Tier order, lowest first. Single source for every progression helper here. */
const ORDERED_TIERS: readonly TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

/**
 * Own keys of TIER_CONFIGS, as a set.
 *
 * Membership must not be tested with `TIER_CONFIGS[tier] !== undefined`: that
 * is an inherited-property lookup, so a wire value named after anything on
 * Object.prototype - 'toString', 'constructor', 'valueOf' - passes the check
 * and then hands the caller a function where a TierConfig was expected.
 */
const VALID_TIERS: ReadonlySet<string> = new Set(Object.keys(TIER_CONFIGS));

/**
 * Coerce a tier that came off the wire to one we actually have a config for.
 *
 * `currentTier` is typed `TierName`, but the value originates from the API and
 * a type is not a runtime check. A tier this file does not know - a legacy
 * account, a casing mismatch, a tier added server-side first - used to reach
 * `TIER_CONFIGS[currentTier].minPoints` and throw
 * "Cannot read property 'minPoints' of undefined", taking the whole Loyalty
 * screen into the error boundary rather than degrading.
 *
 * `indexOf` returning -1 was the second half of the same bug: an unknown tier
 * cleared the "already at the top tier" guard and then indexed `-1 + 1`, so
 * even without the throw it would have reported progress toward Bronze.
 *
 * Bronze is the right floor: it is the entry tier and what the backend itself
 * defaults to (`currentTier: doc.currentTier ?? 'Bronze'`).
 */
export function normalizeTier(tier: TierName): TierName {
  return VALID_TIERS.has(tier) ? tier : 'Bronze';
}

/**
 * Get the tier config for a given tier name.
 * Falls back to Bronze if the name is unrecognised.
 */
export function getTierConfig(tier: TierName): TierConfig {
  return TIER_CONFIGS[normalizeTier(tier)];
}

/**
 * Calculate progress (0..1) toward the next tier.
 * Returns 1 if the user is already at the highest tier (Platinum).
 */
export function getTierProgress(currentTier: TierName, lifetimePoints: number): number {
  const tier = normalizeTier(currentTier);
  const currentIdx = ORDERED_TIERS.indexOf(tier);

  if (currentIdx >= ORDERED_TIERS.length - 1) {
    return 1; // Already Platinum
  }

  const currentMin = TIER_CONFIGS[tier].minPoints;
  const nextTier = ORDERED_TIERS[currentIdx + 1];
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
  const currentIdx = ORDERED_TIERS.indexOf(normalizeTier(currentTier));

  if (currentIdx >= ORDERED_TIERS.length - 1) return 0;

  const nextTier = ORDERED_TIERS[currentIdx + 1];
  if (nextTier === undefined) return 0;
  const nextMin = TIER_CONFIGS[nextTier].minPoints;

  return Math.max(nextMin - lifetimePoints, 0);
}
