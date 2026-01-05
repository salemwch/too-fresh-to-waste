/**
 * NearbyOffersEmptyState Types
 */

import type { ViewStyle } from 'react-native';

export interface NearbyOffersEmptyStateProps {
  /** Current search radius in km */
  radiusKm: number;
  /** Called when user wants to expand search radius */
  onExpandRadius?: () => void;
  /** Called when user wants to browse all offers */
  onBrowseAll?: () => void;
  /** Container style override */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}
