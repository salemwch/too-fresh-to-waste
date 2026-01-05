/**
 * Badge Component - Type Definitions
 */

import type { ComponentSize, StyleSystemProps } from '../../../types';
import type { ViewProps } from 'react-native';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral';

export type BadgeSize = ComponentSize;

export interface BadgeProps extends Omit<ViewProps, 'style'>, StyleSystemProps {
  /**
   * Badge variant - affects colors
   */
  variant?: BadgeVariant;

  /**
   * Badge size
   */
  size?: BadgeSize;

  /**
   * Badge content/label
   */
  label?: string | number;

  /**
   * Icon to display before label
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to display after label
   */
  rightIcon?: React.ReactNode;

  /**
   * Whether badge is a dot (no label)
   */
  dot?: boolean;

  /**
   * Whether badge is outlined (transparent background with border)
   */
  outlined?: boolean;

  /**
   * Custom background color
   */
  backgroundColor?: string;

  /**
   * Custom text/icon color
   */
  color?: string;

  /**
   * Custom border color (for outlined variant)
   */
  borderColor?: string;

  /**
   * Custom style overrides
   */
  style?: any;

  /**
   * Custom text style
   */
  textStyle?: any;

  /**
   * Whether badge is pressable
   */
  pressable?: boolean;

  /**
   * Press handler
   */
  onPress?: () => void;

  /**
   * Whether to show close/remove button
   */
  closable?: boolean;

  /**
   * Close handler
   */
  onClose?: () => void;
}
