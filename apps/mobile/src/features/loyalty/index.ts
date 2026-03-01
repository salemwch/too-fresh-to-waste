/**
 * Loyalty Feature — barrel export
 */

export { LoyaltyScreen } from './screens/LoyaltyScreen';
export { useLoyalty } from './hooks/useLoyalty';
export { useLoginStreak } from './hooks/useLoginStreak';
export { loyaltyService } from './services/loyaltyService';
export type {
  LoyaltyAccount,
  GamificationStats,
  LoginStreakResponse,
  Badge,
  PointTransaction,
  TierName,
  BadgeType,
} from './types/loyalty.types';
