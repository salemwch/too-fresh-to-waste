/**
 * PhoneInput Component Types
 */

import type { CountryCode } from 'libphonenumber-js';
import type { TextInputProps, ViewStyle, TextStyle, StyleProp } from 'react-native';

export interface PhoneInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  /**
   * Current phone number value
   */
  value: string;

  /**
   * Callback when phone number changes
   * Returns E.164 formatted number (+12133734253)
   */
  onChangeText: (value: string) => void;

  /**
   * Selected country code
   */
  countryCode?: CountryCode;

  /**
   * Callback when country code changes
   */
  onCountryChange?: (country: CountryCode) => void;

  /**
   * Label for the input
   */
  label?: string | React.ReactNode;

  /**
   * Helper text displayed below input
   */
  helperText?: string | undefined;

  /**
   * Error text displayed below input
   */
  errorText?: string | undefined;

  /**
   * Whether input has error state
   */
  hasError?: boolean;

  /**
   * Whether field is required
   */
  required?: boolean;

  /**
   * Whether to show country selector
   * @default true
   */
  showCountryPicker?: boolean;

  /**
   * Whether to format phone number as user types
   * @default true
   */
  enableAutoFormat?: boolean;

  /**
   * Filter countries to show in picker
   * If not provided, shows default supported countries
   */
  allowedCountries?: CountryCode[];

  /**
   * Container style
   */
  containerStyle?: StyleProp<ViewStyle>;

  /**
   * Input container style
   */
  inputContainerStyle?: StyleProp<ViewStyle>;

  /**
   * Input text style
   */
  inputStyle?: StyleProp<TextStyle>;

  /**
   * Label style
   */
  labelStyle?: StyleProp<TextStyle>;

  /**
   * Helper text style
   */
  helperTextStyle?: StyleProp<TextStyle>;

  /**
   * Error text style
   */
  errorTextStyle?: StyleProp<TextStyle>;

  /**
   * Country picker button style
   */
  countryPickerStyle?: StyleProp<ViewStyle>;

  /**
   * Whether input is disabled
   */
  disabled?: boolean;

  /**
   * Whether input is read-only
   */
  readOnly?: boolean;

  /**
   * Test ID for testing
   */
  testID?: string;

  /**
   * Accessibility label
   */
  accessibilityLabel?: string;

  /**
   * Accessibility hint
   */
  accessibilityHint?: string;
}

export type PhoneInputState = 'default' | 'focused' | 'error' | 'disabled';
