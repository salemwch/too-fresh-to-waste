/**
 * OfferCard Organism - Type Definitions
 * Production-ready card component for displaying food offers
 * Aligned with backend schema: apps/food-waste-backend/src/offers/schemas/offer.schema.ts
 */
import type { OfferListItem, OfferType } from '@/features/offers/types';
import type { ViewStyle, ImageStyle } from 'react-native';

/**
 * Mascot strip variant — maps to the four HomeScreen offer sections
 */
export type MascotVariant = 'urgent' | 'hottest' | 'today' | 'tomorrow';

/**
 * Card variant determines visual emphasis and badge display
 */
type OfferCardVariant = 'nearby' | 'featured' | 'surprise' | 'default';

/**
 * Card layout determines overall structure and sizing
 */
type OfferCardLayout = 'compact' | 'standard' | 'detailed';

/**
 * Card orientation for flexible layouts
 */
type OfferCardOrientation = 'vertical' | 'horizontal';

/**
 * Badge configuration for overlay indicators
 */
interface OfferBadge {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
}

/**
 * Core OfferCard props
 */
export interface OfferCardProps {
  // ==================== Required ====================
  /**
   * Offer data from backend API
   */
  offer: OfferListItem;

  // ==================== Variant & Layout ====================
  /**
   * Visual variant controlling badges and emphasis
   * @default 'default'
   */
  variant?: OfferCardVariant;

  /**
   * Card layout affecting size and detail level
   * @default 'standard'
   */
  layout?: OfferCardLayout;

  /**
   * Card orientation
   * @default 'vertical'
   */
  orientation?: OfferCardOrientation;

  // ==================== Display Options ====================
  /**
   * Show establishment name and logo
   * @default true
   */
  showEstablishment?: boolean;

  /**
   * Show pickup time slot information
   * @default true
   */
  showPickupTime?: boolean;

  /**
   * Show distance from user (requires offer.distance)
   * @default true
   */
  showDistance?: boolean;

  /**
   * Show items left badge
   * @default true
   */
  showItemsLeft?: boolean;

  /**
   * Show discount percentage badge
   * @default true
   */
  showDiscountBadge?: boolean;

  /**
   * Show custom badges (e.g., "NEW", "SUPERMARKET")
   * @default []
   */
  badges?: OfferBadge[];

  /**
   * Show favorite button
   * @default true
   */
  showFavorite?: boolean;

  /**
   * Maximum lines for title
   * @default 2
   */
  titleLines?: number;

  /**
   * Image aspect ratio
   * @default 4/3
   */
  imageAspectRatio?: number;

  // ==================== Actions ====================
  /**
   * Callback when card is pressed
   */
  onPress?: (offer: OfferListItem) => void;

  /**
   * Callback when favorite button is pressed
   */
  onFavorite?: (offer: OfferListItem) => void;

  /**
   * Callback when establishment name is pressed
   */
  onEstablishmentPress?: (establishmentId: string) => void;

  // ==================== State ====================
  /**
   * Whether this offer is in user's favorites
   * @default false
   */
  isFavorite?: boolean;

  /**
   * Show loading skeleton
   * @default false
   */
  loading?: boolean;

  /**
   * Disable all interactions
   * @default false
   */
  disabled?: boolean;

  // ==================== Styling ====================
  /**
   * Container style override
   */
  style?: ViewStyle;

  /**
   * Image container style override
   */
  imageStyle?: ImageStyle;

  /**
   * Content area style override
   */
  contentStyle?: ViewStyle;

  // ==================== Accessibility ====================
  /**
   * Test ID for automated testing
   * @default 'offer-card'
   */
  testID?: string;

  /**
   * Accessibility label override
   */
  accessibilityLabel?: string;

  /**
   * Accessibility hint override
   */
  accessibilityHint?: string;

  /**
   * Bag mascot strip variant — shows the personality strip below the photo.
   * Maps to the four HomeScreen sections: urgent, hottest, today, tomorrow.
   * Omit for cards rendered outside those sections (e.g., favorites, search).
   */
  mascotVariant?: MascotVariant;

  /**
   * Translated copy for the mascot strip. Required when mascotVariant is set.
   * Provided by the caller (e.g. HomeScreen via t('home.mascotUrgent')) so the
   * OfferCard design-system component stays decoupled from the app's i18n instance.
   */
  mascotCopy?: string;
}

/**
 * Helper type for mapping OfferType to display strings
 */
export const offerTypeLabels: Record<OfferType, string> = {
  surprise_bag: 'Surprise Bag',
  specific_items: 'Specific Items',
  meal_deal: 'Meal Deal',
  parcels_bag: 'Parcels Bag',
};

/**
 * Helper function to format pickup time from time slots or ISO timestamp
 * Priority: pickupTimeSlots > availableUntil
 *
 * @param pickupTimeSlots - Optional array of pickup time slots (HH:mm format)
 * @param availableUntil - ISO timestamp fallback
 * @returns Formatted pickup time string or null
 */
export const formatPickupTime = (
  pickupTimeSlots?: Array<{ startTime: string; endTime: string }>,
  availableUntil?: string,
): string | null => {
  try {
    // Priority 1: Use pickup time slots if available (stored in local time)
    if (pickupTimeSlots && pickupTimeSlots.length > 0) {
      const firstSlot = pickupTimeSlots[0];
      // Format: "14:40 - 23:46" with proper spacing and dash
      return `${firstSlot?.startTime} - ${firstSlot?.endTime}`;
    }

    // Priority 2: Fallback to availableUntil timestamp
    // Convert UTC to local timezone for display
    if (availableUntil != null) {
      const until = new Date(availableUntil);
      const formatTime = (date: Date) =>
        date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      return formatTime(until);
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Helper function to format distance
 */
export const formatDistance = (distanceInMeters?: number): string | null => {
  if (distanceInMeters === undefined || distanceInMeters === null) return null;

  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`;
  }

  return `${(distanceInMeters / 1000).toFixed(1)}km`;
};

/**
 * Helper function to format the start time for not-yet-started offers.
 * Stored times are "display times" (Tunisia local) stored as UTC — extract UTC components directly.
 *
 * @param availableFrom - ISO timestamp of when the offer starts
 * @returns Formatted "HH:MM" string or null on error
 */
export const formatStartTime = (availableFrom: string): string | null => {
  try {
    const from = new Date(availableFrom);
    return from.toLocaleTimeString('en-US', {
      timeZone: 'Africa/Tunis',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
};
