/**
 * Card Component - Type Definitions
 */

import type { StyleSystemProps } from '../../../types';
import type { ViewProps, StyleProp, ViewStyle } from 'react-native';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';
export type CardSize = 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<ViewProps, 'style'>, StyleSystemProps {
  /**
   * Card variant - affects styling and elevation
   */
  variant?: CardVariant;

  /**
   * Card size - affects padding and dimensions
   */
  size?: CardSize;

  /**
   * Whether the card is pressable
   */
  pressable?: boolean;

  /**
   * Callback when card is pressed (only works when pressable is true)
   */
  onPress?: () => void;

  /**
   * Whether to show loading state
   */
  loading?: boolean;

  /**
   * Whether the card is disabled
   */
  disabled?: boolean;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Content to render inside the card
   */
  children?: React.ReactNode;

  /**
   * Platform-specific styling preference
   */
  platform?: 'ios' | 'android' | 'auto';

  /**
   * Animation configuration for pressable cards
   */
  animation?: {
    scale?: number;
    duration?: number;
  };

  /**
   * Minimum ms between accepted presses (0 = no guard).
   * Prevents double-tap from firing duplicate navigation or side-effects.
   */
  pressGuardMs?: number;
}
