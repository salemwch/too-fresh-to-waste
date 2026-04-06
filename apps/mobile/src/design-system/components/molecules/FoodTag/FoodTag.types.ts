/**
 * FoodTag Molecule - Type Definitions
 * Chip/Button + Icon + Color Token for food categorization and status
 */

import type {
  BaseComponentProps,
  ComponentSize,
  FoodCategory,
  DietaryType,
  FreshnessLevel,
} from '../../../types';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type FoodTagVariant = 'category' | 'dietary' | 'freshness' | 'status' | 'custom';

export interface FoodTagProps extends BaseComponentProps {
  /**
   * Tag text content
   */
  children: React.ReactNode;

  /**
   * Tag variant determines color and styling
   */
  variant?: FoodTagVariant;

  /**
   * Tag size
   */
  size?: ComponentSize;

  /**
   * Food category (when variant is 'category')
   */
  category?: FoodCategory;

  /**
   * Dietary type (when variant is 'dietary')
   */
  dietaryType?: DietaryType;

  /**
   * Freshness level (when variant is 'freshness')
   */
  freshnessLevel?: FreshnessLevel;

  /**
   * Custom color override
   */
  color?: string;

  /**
   * Custom background color override
   */
  backgroundColor?: string;

  /**
   * Icon to display before text
   */
  icon?: React.ReactNode;

  /**
   * Whether the tag is pressable
   */
  pressable?: boolean;

  /**
   * Press handler (when pressable is true)
   */
  onPress?: () => void;

  /**
   * Whether the tag is selected (for filter tags)
   */
  selected?: boolean;

  /**
   * Whether the tag is disabled
   */
  disabled?: boolean;

  /**
   * Whether to show close/remove button
   */
  closable?: boolean;

  /**
   * Close button press handler
   */
  onClose?: () => void;

  /**
   * Custom close icon
   */
  closeIcon?: React.ReactNode;

  /**
   * Border radius override
   */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';

  /**
   * Custom container style
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Custom text style
   */
  textStyle?: StyleProp<TextStyle>;

  /**
   * Maximum width constraint
   */
  maxWidth?: number;

  /**
   * Whether text should truncate with ellipsis
   */
  truncate?: boolean;

  // Note: Accessibility props are inherited from BaseComponentProps
  // No need to redefine them here to avoid type conflicts
}
