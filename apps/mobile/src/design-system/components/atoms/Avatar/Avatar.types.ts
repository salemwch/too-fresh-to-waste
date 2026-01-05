/**
 * Avatar Component - Type Definitions
 */

import type { ComponentSize, StyleSystemProps } from '../../../types';
import type { ViewProps, ImageSourcePropType } from 'react-native';

export type AvatarSize = ComponentSize | number;

export type AvatarVariant = 'circular' | 'rounded' | 'square';

export interface AvatarProps extends Omit<ViewProps, 'style'>, StyleSystemProps {
  /**
   * Avatar size - predefined or custom number
   */
  size?: AvatarSize;

  /**
   * Avatar variant/shape
   */
  variant?: AvatarVariant;

  /**
   * Image source for avatar
   */
  source?: ImageSourcePropType;

  /**
   * Image URI for avatar
   */
  uri?: string;

  /**
   * Fallback initials if no image
   */
  initials?: string;

  /**
   * Fallback icon name if no image or initials
   */
  iconName?: string;

  /**
   * Background color for avatar container
   */
  backgroundColor?: string;

  /**
   * Text/Icon color
   */
  color?: string;

  /**
   * Border color
   */
  borderColor?: string;

  /**
   * Border width
   */
  borderWidth?: number;

  /**
   * Whether to show online status indicator
   */
  showStatus?: boolean;

  /**
   * Status indicator type
   */
  status?: 'online' | 'offline' | 'away' | 'busy';

  /**
   * Custom style overrides
   */
  style?: any;

  /**
   * Custom image style
   */
  imageStyle?: any;

  /**
   * Whether avatar is pressable
   */
  pressable?: boolean;

  /**
   * Press handler
   */
  onPress?: () => void;

  /**
   * Loading state
   */
  loading?: boolean;
}
