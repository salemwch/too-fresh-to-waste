/**
 * LocationPromptBanner Types
 */

import type { ViewStyle } from 'react-native';

type LocationPromptBannerVariant = 'compact' | 'expanded';

export interface LocationPromptBannerProps {
  /** Called when user taps "Enable" button */
  onEnable: () => void;
  /** Called when user taps dismiss (X) button */
  onDismiss: () => void;
  /** Visual variant */
  variant?: LocationPromptBannerVariant;
  /** Whether enable action is loading */
  isLoading?: boolean;
  /** Container style override */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}
