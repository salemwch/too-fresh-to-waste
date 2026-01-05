/**
 * DistanceBadge Types
 */

import type { ViewStyle, TextStyle } from 'react-native';

export type DistanceBadgeVariant = 'default' | 'compact' | 'pill';

export interface DistanceBadgeProps {
  /** Distance in meters */
  distance: number;
  /** Visual variant */
  variant?: DistanceBadgeVariant;
  /** Show icon */
  showIcon?: boolean;
  /** Container style override */
  style?: ViewStyle;
  /** Text style override */
  textStyle?: TextStyle;
  /** Test ID */
  testID?: string;
  /** Accessibility label override */
  accessibilityLabel?: string;
}
