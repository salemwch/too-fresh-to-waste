/**
 * Button Component - Type Definitions
 */

import type { ComponentSize, StyleSystemProps, IconFamily } from '../../../types';
import type { PressableProps } from 'react-native';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'outline'
  | 'text';

export type ButtonSize = ComponentSize;

export interface ButtonProps extends Omit<PressableProps, 'style'>, StyleSystemProps {
  /**
   * Button variant - affects colors and styling
   */
  variant?: ButtonVariant;

  /**
   * Button size - affects padding and text size
   */
  size?: ButtonSize;

  /**
   * Button text content
   */
  children?: React.ReactNode;

  /**
   * Loading state - shows spinner and disables interaction
   */
  loading?: boolean;

  /**
   * Icon to display before text (ReactNode or icon name string)
   */
  leftIcon?: React.ReactNode | string;

  /**
   * Icon family for left icon (required if leftIcon is a string)
   */
  leftIconFamily?: IconFamily;

  /**
   * Icon to display after text (ReactNode or icon name string)
   */
  rightIcon?: React.ReactNode | string;

  /**
   * Icon family for right icon (required if rightIcon is a string)
   */
  rightIconFamily?: IconFamily;

  /**
   * Whether button should take full width of container
   */
  fullWidth?: boolean;

  /**
   * Platform-specific styling preference
   */
  platform?: 'ios' | 'android' | 'auto';

  /**
   * Custom style overrides
   */
  style?: any;

  /**
   * Text style overrides
   */
  textStyle?: any;

  /**
   * Haptic feedback on press (iOS/Android)
   */
  hapticFeedback?: boolean;

  /**
   * Animation configuration
   */
  animation?: {
    scale?: number;
    duration?: number;
  };

  /**
   * Press guard cooldown in milliseconds.
   * When set, rapid taps within this window are ignored.
   * Useful for buttons that trigger API calls or navigation.
   * Set to 0 or undefined to disable (default: disabled).
   */
  pressGuardMs?: number;
}
