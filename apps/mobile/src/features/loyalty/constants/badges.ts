/**
 * Badge Metadata
 * Visual config for all 12 badge types.
 *
 * Source: BadgeType enum in backend loyalty-account.schema.ts
 */

import { BadgeType } from '../types/loyalty.types';
import { colorTokens } from '@/design-system/tokens/colors';

export interface BadgeMetadata {
  type: BadgeType;
  title: string;
  description: string;
  icon: string;
  iconFamily: 'Ionicons';
  color: string;
  bgColor: string;
}

export const BADGE_METADATA: Record<BadgeType, BadgeMetadata> = {
  [BadgeType.NEWCOMER]: {
    type: BadgeType.NEWCOMER,
    title: 'Newcomer',
    description: 'Welcome to the community!',
    icon: 'star-outline',
    iconFamily: 'Ionicons',
    color: colorTokens.base.warning[500],
    bgColor: '#FEF3C7',
  },
  [BadgeType.ECO_WARRIOR]: {
    type: BadgeType.ECO_WARRIOR,
    title: 'Eco Warrior',
    description: 'Saved 50+ bags from waste',
    icon: 'leaf-outline',
    iconFamily: 'Ionicons',
    color: colorTokens.base.success[500],
    bgColor: '#D1FAE5',
  },
  [BadgeType.FREQUENT_SAVER]: {
    type: BadgeType.FREQUENT_SAVER,
    title: 'Frequent Saver',
    description: 'Ordered 25+ surprise bags',
    icon: 'bag-handle-outline',
    iconFamily: 'Ionicons',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
  },
  [BadgeType.EARLY_BIRD]: {
    type: BadgeType.EARLY_BIRD,
    title: 'Early Bird',
    description: 'Picked up before 10 AM',
    icon: 'sunny-outline',
    iconFamily: 'Ionicons',
    color: '#F97316',
    bgColor: '#FED7AA',
  },
  [BadgeType.NIGHT_OWL]: {
    type: BadgeType.NIGHT_OWL,
    title: 'Night Owl',
    description: 'Picked up after 8 PM',
    icon: 'moon-outline',
    iconFamily: 'Ionicons',
    color: '#6366F1',
    bgColor: '#E0E7FF',
  },
  [BadgeType.LOYAL_CUSTOMER]: {
    type: BadgeType.LOYAL_CUSTOMER,
    title: 'Loyal Customer',
    description: 'Active for 6+ months',
    icon: 'heart-outline',
    iconFamily: 'Ionicons',
    color: '#EC4899',
    bgColor: '#FCE7F3',
  },
  [BadgeType.SUPER_SAVER]: {
    type: BadgeType.SUPER_SAVER,
    title: 'Super Saver',
    description: 'Saved 100+ TND on orders',
    icon: 'cash-outline',
    iconFamily: 'Ionicons',
    color: '#14B8A6',
    bgColor: '#CCFBF1',
  },
  [BadgeType.COMMUNITY_CHAMPION]: {
    type: BadgeType.COMMUNITY_CHAMPION,
    title: 'Community Champion',
    description: 'Donated points to community',
    icon: 'people-outline',
    iconFamily: 'Ionicons',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
  },
  [BadgeType.STREAK_MASTER]: {
    type: BadgeType.STREAK_MASTER,
    title: 'Streak Master',
    description: 'Maintained a 10-day streak',
    icon: 'flame-outline',
    iconFamily: 'Ionicons',
    color: colorTokens.base.error[500],
    bgColor: '#FEE2E2',
  },
  [BadgeType.REFERRAL_CHAMPION]: {
    type: BadgeType.REFERRAL_CHAMPION,
    title: 'Referral Champion',
    description: 'Referred 5+ friends',
    icon: 'gift-outline',
    iconFamily: 'Ionicons',
    color: colorTokens.base.warning[500],
    bgColor: '#FEF3C7',
  },
  [BadgeType.BUSINESS_RECRUITER]: {
    type: BadgeType.BUSINESS_RECRUITER,
    title: 'Business Recruiter',
    description: 'Referred a business partner',
    icon: 'business-outline',
    iconFamily: 'Ionicons',
    color: '#0EA5E9',
    bgColor: '#E0F2FE',
  },
  [BadgeType.REVIEWER]: {
    type: BadgeType.REVIEWER,
    title: 'Reviewer',
    description: 'Wrote 5+ quality reviews',
    icon: 'chatbubble-ellipses-outline',
    iconFamily: 'Ionicons',
    color: colorTokens.base.neutral[700],
    bgColor: colorTokens.base.neutral[100],
  },
};

/** Ordered list of all badge types for UI iteration */
export const ALL_BADGE_TYPES: BadgeType[] = Object.values(BadgeType);
