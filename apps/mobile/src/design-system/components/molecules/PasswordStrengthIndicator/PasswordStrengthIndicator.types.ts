/**
 * PasswordStrengthIndicator Types
 */

import type { PasswordValidationContext } from '../../../../hooks/usePasswordRules';
import type { ViewStyle, TextStyle } from 'react-native';

export interface PasswordStrengthIndicatorProps {
  /**
   * The password to validate
   */
  password: string;

  /**
   * Context for personal info detection (email, firstName, lastName)
   * Used to check if password contains user's personal information
   */
  context?: PasswordValidationContext;

  /**
   * Show detailed rules list
   * @default true
   */
  showRules?: boolean;

  /**
   * Show overall strength score
   * @default true
   */
  showStrength?: boolean;

  /**
   * Show progress bar
   * @default true
   */
  showProgressBar?: boolean;

  /**
   * Show feedback messages
   * @default true
   */
  showFeedback?: boolean;

  /**
   * Enable haptic feedback when rules are met
   * @default true
   */
  enableHaptic?: boolean;

  /**
   * Enable animations
   * @default true
   */
  enableAnimations?: boolean;

  /**
   * Dropdown/popover mode - shows compact dropdown below input
   * When true, component appears as a floating card below the password field
   * @default false
   */
  dropdownMode?: boolean;

  /**
   * Auto-hide when password is valid (only in dropdown mode)
   * @default true
   */
  autoHideWhenValid?: boolean;

  /**
   * Delay (in ms) before auto-hiding when password becomes valid
   * Gives user time to see all requirements are met
   * Only applies when autoHideWhenValid is true
   * @default 1750 (1.75 seconds)
   */
  autoHideDelay?: number;

  /**
   * Show success cue when all requirements are met
   * Displays a visual confirmation banner in dropdown mode
   * @default true
   */
  showSuccessCue?: boolean;

  /**
   * Callback when password validity changes
   */
  onValidityChange?: (isValid: boolean) => void;

  /**
   * Callback when strength score changes
   */
  onStrengthChange?: (score: number) => void;

  /**
   * Container style
   */
  containerStyle?: ViewStyle;

  /**
   * Progress bar style
   */
  progressBarStyle?: ViewStyle;

  /**
   * Rule item style
   */
  ruleItemStyle?: ViewStyle;

  /**
   * Rule text style
   */
  ruleTextStyle?: TextStyle;

  /**
   * Feedback text style
   */
  feedbackTextStyle?: TextStyle;

  /**
   * Test ID for testing
   */
  testID?: string;
}

export type PasswordStrengthState = 'initial' | 'weak' | 'fair' | 'good' | 'excellent';
