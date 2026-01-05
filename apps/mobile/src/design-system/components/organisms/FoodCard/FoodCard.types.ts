/**
 * FoodCard Organism - Type Definitions
 * Card + Image + PriceDisplay + CTA Button for food offer display
 */

import type { BaseComponentProps } from '../../../types';

export interface FoodOfferData {
  id: string;
  title: string;
  description?: string;
  imageUri?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  quantity: number;
  availableQuantity: number;
  establishmentName: string;
  establishmentId: string;
  category?: string;
  dietaryTags?: string[];
  freshnessLevel?: 'fresh' | 'moderate' | 'urgent' | 'expired';
  pickupTimeStart?: string;
  pickupTimeEnd?: string;
  distance?: number;
  rating?: number;
  reviewCount?: number;
  isFavorite?: boolean;
  isReserved?: boolean;
  estimatedWeight?: string;
}

export interface FoodCardActions {
  onPress?: (offer: FoodOfferData) => void;
  onReserve?: (offer: FoodOfferData) => void;
  onFavorite?: (offer: FoodOfferData) => void;
  onShare?: (offer: FoodOfferData) => void;
  onViewEstablishment?: (establishmentId: string) => void;
}

export interface FoodCardProps extends BaseComponentProps, FoodCardActions {
  /**
   * Food offer data
   */
  offer: FoodOfferData;

  /**
   * Card layout variant
   */
  layout?: 'compact' | 'standard' | 'detailed';

  /**
   * Card orientation
   */
  orientation?: 'vertical' | 'horizontal';

  /**
   * Whether to show all offer details
   */
  showDetails?: boolean;

  /**
   * Whether to show action buttons
   */
  showActions?: boolean;

  /**
   * Whether to show favorite button
   */
  showFavorite?: boolean;

  /**
   * Whether to show share button
   */
  showShare?: boolean;

  /**
   * Whether to show establishment info
   */
  showEstablishment?: boolean;

  /**
   * Whether to show pickup time
   */
  showPickupTime?: boolean;

  /**
   * Whether to show distance
   */
  showDistance?: boolean;

  /**
   * Whether to show rating
   */
  showRating?: boolean;

  /**
   * Whether card is loading
   */
  loading?: boolean;

  /**
   * Whether card is disabled
   */
  disabled?: boolean;

  /**
   * Image aspect ratio
   */
  imageAspectRatio?: number;

  /**
   * Maximum lines for title
   */
  titleLines?: number;

  /**
   * Maximum lines for description
   */
  descriptionLines?: number;

  /**
   * Custom card style
   */
  style?: any;

  /**
   * Custom image style
   */
  imageStyle?: any;

  /**
   * Custom content style
   */
  contentStyle?: any;

  /**
   * Custom action area style
   */
  actionStyle?: any;

  /**
   * Reserve button text override
   */
  reserveButtonText?: string;

  /**
   * Accessibility label override
   */
  accessibilityLabel?: string;
}
