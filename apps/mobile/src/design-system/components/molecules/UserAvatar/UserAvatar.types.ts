/**
 * UserAvatar Molecule - Type Definitions
 * Image + StatusDot for user profile display
 */

import type { BaseComponentProps, ComponentSize } from '../../../types';

export type UserAvatarVariant = 'circular' | 'rounded' | 'square';
export type UserStatus = 'online' | 'offline' | 'busy' | 'away' | 'invisible';

export interface UserAvatarProps extends BaseComponentProps {
  /**
   * User's name for fallback initials and accessibility
   */
  name: string;

  /**
   * Avatar image URI
   */
  imageUri?: string;

  /**
   * Avatar size
   */
  size?: ComponentSize;

  /**
   * Avatar shape variant
   */
  variant?: UserAvatarVariant;

  /**
   * User's online status
   */
  status?: UserStatus;

  /**
   * Whether to show status indicator
   */
  showStatus?: boolean;

  /**
   * Whether the avatar is pressable
   */
  pressable?: boolean;

  /**
   * Press handler
   */
  onPress?: () => void;

  /**
   * Fallback background color for initials
   */
  backgroundColor?: string;

  /**
   * Text color for initials
   */
  textColor?: string;

  /**
   * Custom border color
   */
  borderColor?: string;

  /**
   * Border width
   */
  borderWidth?: number;

  /**
   * Whether to show loading state
   */
  loading?: boolean;

  /**
   * Custom loading component
   */
  loadingComponent?: React.ReactNode;

  /**
   * Image load error handler
   */
  onImageError?: () => void;

  /**
   * Image load success handler
   */
  onImageLoad?: () => void;

  /**
   * Whether avatar represents a merchant/business
   */
  isMerchant?: boolean;

  /**
   * Merchant verification badge
   */
  verified?: boolean;

  /**
   * Custom badge component
   */
  badge?: React.ReactNode;

  /**
   * Badge position
   */
  badgePosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

  /**
   * Custom container style
   */
  style?: any;

  /**
   * Custom image style
   */
  imageStyle?: any;

  /**
   * Custom initials text style
   */
  textStyle?: any;

  /**
   * Image resize mode
   */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';

  /**
   * Accessibility label override
   */
  accessibilityLabel?: string;
}
