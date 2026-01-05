/**
 * LocationStatusBadge Types
 */

import type { ViewStyle, TextStyle } from 'react-native';

export type LocationMode = 'gps' | 'manual' | 'off';

export interface LocationStatusBadgeProps {
  /** Current location mode */
  mode: LocationMode;
  /** Location name to display (for manual mode) */
  locationName?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Make badge pressable */
  onPress?: () => void;
  /** Container style override */
  style?: ViewStyle;
  /** Text style override */
  textStyle?: TextStyle;
  /** Test ID */
  testID?: string;
  /** Accessibility hint */
  accessibilityHint?: string;
}
