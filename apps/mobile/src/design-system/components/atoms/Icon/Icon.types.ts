/**
 * Icon Component - Type Definitions
 */

import type {
  BaseComponentProps,
  ComponentSize,
  StyleSystemProps,
  IconFamily,
} from '../../../types';
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native';

export type IconSize = ComponentSize | number;

type IconVariant = 'default' | 'filled' | 'outlined' | 'rounded' | 'sharp';

export interface IconProps
  extends
    Omit<
      ViewProps,
      | 'style'
      | 'testID'
      | 'accessible'
      | 'accessibilityLabel'
      | 'accessibilityHint'
      | 'accessibilityRole'
      | 'accessibilityState'
      | 'accessibilityValue'
    >,
    BaseComponentProps,
    Omit<StyleSystemProps, 'padding' | 'borderRadius'> {
  /**
   * Icon name - should match vector icons library
   */
  name: string;

  /**
   * Icon size - predefined or custom number
   */
  size?: IconSize;

  /**
   * Icon color
   */
  color?: string;

  /**
   * Icon variant/style
   */
  variant?: IconVariant;

  /**
   * Icon library/family (e.g., MaterialIcons, FontAwesome)
   * Using react-native-vector-icons - supports all 15 icon families
   */
  family?: IconFamily;

  /**
   * Custom style overrides
   */
  style?: StyleProp<TextStyle>;

  /**
   * Container style overrides
   */
  containerStyle?: StyleProp<ViewStyle>;

  /**
   * Whether icon is disabled
   */
  disabled?: boolean;

  /**
   * Background color for icon container
   */
  backgroundColor?: string;

  /**
   * Border radius for icon container
   */
  borderRadius?: number;

  /**
   * Padding around icon
   */
  padding?: number;
}
