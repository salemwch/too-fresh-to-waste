/**
 * Donation Type Definitions
 * Enterprise-grade TypeScript interfaces for donation features
 */

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { DonationPoolStatus } from '@foodwaste/shared';

export type { DonationStats, UserDonationStats, OrderWithDonation } from '@foodwaste/shared';

// ============================================================================
// Mobile-only types
// ============================================================================

/**
 * API response wrapper (mobile-specific generic)
 */
export interface DonationApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
