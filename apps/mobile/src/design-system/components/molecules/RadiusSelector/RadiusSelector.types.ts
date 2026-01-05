/**
 * RadiusSelector Types
 */

import type { ViewStyle } from 'react-native';

export type RadiusSelectorVariant = 'buttons' | 'chips';

export interface RadiusSelectorProps {
  /** Current selected radius in km */
  value: number;
  /** Called when radius is changed */
  onChange: (radiusKm: number) => void;
  /** Preset radius options in km (default: [5, 10, 25, 50]) */
  presets?: number[];
  /** Visual variant */
  variant?: RadiusSelectorVariant;
  /** Label shown above selector */
  label?: string;
  /** Whether selector is disabled */
  disabled?: boolean;
  /** Container style override */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}
