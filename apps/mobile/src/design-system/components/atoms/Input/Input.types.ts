/**
 * Input Component - Type Definitions
 */

import type {
  BaseComponentProps,
  ComponentSize,
  StyleSystemProps,
  IconFamily,
} from '../../../types';
import type { TextInputProps } from 'react-native';

export type InputVariant = 'default' | 'filled' | 'outlined';
export type InputSize = ComponentSize;
export type InputState = 'default' | 'focused' | 'error' | 'disabled';

// Re-export IconFamily for convenience
export type { IconFamily };

export interface InputProps
  extends Omit<
      TextInputProps,
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
    StyleSystemProps {
  /**
   * Input variant - affects styling and appearance
   */
  variant?: InputVariant;

  /**
   * Input size - affects padding and text size
   */
  size?: InputSize;

  /**
   * Label text or element displayed above input
   */
  label?: React.ReactNode;

  /**
   * Helper text displayed below input
   */
  helperText?: string;

  /**
   * Error text displayed below input (takes precedence over helperText)
   */
  errorText?: string | undefined;

  /**
   * Error text alias (for react-hook-form compatibility)
   */
  error?: string | undefined;

  /**
   * Whether the input is in error state
   */
  hasError?: boolean;

  /**
   * Icon to display on the left side (ReactNode or icon name string)
   */
  leftIcon?: React.ReactNode | string;

  /**
   * Icon family for left icon (required if leftIcon is a string)
   */
  leftIconFamily?: IconFamily;

  /**
   * Icon to display on the right side (ReactNode or icon name string)
   */
  rightIcon?: React.ReactNode | string;

  /**
   * Icon family for right icon (required if rightIcon is a string)
   */
  rightIconFamily?: IconFamily;

  /**
   * Icon size (default: 20)
   */
  iconSize?: number;

  /**
   * Icon color (uses theme color if not provided)
   */
  iconColor?: string;

  /**
   * Callback when right icon is pressed (useful for password toggle)
   */
  onRightIconPress?: () => void;

  /**
   * Callback when left icon is pressed
   */
  onLeftIconPress?: () => void;

  /**
   * Whether the input is required (shows asterisk in label)
   */
  required?: boolean;

  /**
   * Whether the input should take full width
   */
  fullWidth?: boolean;

  /**
   * Whether the input is disabled
   */
  disabled?: boolean;

  /**
   * Whether the input is read-only
   */
  readOnly?: boolean;

  /**
   * Custom container style
   */
  containerStyle?: any;

  /**
   * Custom input style
   */
  inputStyle?: any;

  /**
   * Custom input container style (for border, background, etc.)
   */
  inputContainerStyle?: any;

  /**
   * Custom label style
   */
  labelStyle?: any;

  /**
   * Custom helper text style
   */
  helperTextStyle?: any;

  /**
   * Custom error text style
   */
  errorTextStyle?: any;

  /**
   * Style prop (alias for containerStyle)
   */
  style?: any;

  /**
   * Callback when focus state changes
   */
  onFocusChange?: (focused: boolean) => void;

  /**
   * Platform-specific styling preference
   */
  platform?: 'ios' | 'android' | 'auto';
}
