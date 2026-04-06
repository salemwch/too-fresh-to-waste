/**
 * FormField Molecule - Type Definitions
 * Combines Label + Input + ErrorText for complete form field functionality
 */

import type { BaseComponentProps } from '../../../types';
import type { InputProps } from '../../atoms/Input';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export interface FormFieldProps extends BaseComponentProps {
  /**
   * Field label text
   */
  label?: string;

  /**
   * Field value
   */
  value: string;

  /**
   * Change handler
   */
  onChangeText: (text: string) => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Helper text shown below input
   */
  helperText?: string;

  /**
   * Error text (takes precedence over helperText)
   */
  errorText?: string;

  /**
   * Whether field has validation error
   */
  hasError?: boolean;

  /**
   * Whether field is required (shows asterisk)
   */
  required?: boolean;

  /**
   * Whether field is disabled
   */
  disabled?: boolean;

  /**
   * Input type for validation and keyboard
   */
  type?: 'text' | 'email' | 'password' | 'phone' | 'number' | 'url';

  /**
   * Validation pattern for input sanitization
   */
  validationPattern?: RegExp;

  /**
   * Maximum input length
   */
  maxLength?: number;

  /**
   * Minimum input length for validation
   */
  minLength?: number;

  /**
   * Whether to validate on change or on blur
   */
  validateOnChange?: boolean;

  /**
   * Custom validation function
   */
  validator?: (value: string) => string | null;

  /**
   * Left icon for input
   */
  leftIcon?: React.ReactNode;

  /**
   * Right icon for input
   */
  rightIcon?: React.ReactNode;

  /**
   * Whether to show password visibility toggle (for password type)
   */
  showPasswordToggle?: boolean;

  /**
   * Input size
   */
  size?: InputProps['size'];

  /**
   * Input variant
   */
  variant?: InputProps['variant'];

  /**
   * Auto-complete type
   */
  autoComplete?: 'email' | 'password' | 'name' | 'phone' | 'address' | 'off';

  /**
   * Text content type (iOS)
   */
  textContentType?: 'emailAddress' | 'password' | 'name' | 'telephoneNumber' | 'postalCode';

  /**
   * Keyboard type
   */
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url';

  /**
   * Auto-capitalize
   */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';

  /**
   * Auto-correct
   */
  autoCorrect?: boolean;

  /**
   * Spell check
   */
  spellCheck?: boolean;

  /**
   * Custom container style
   */
  containerStyle?: StyleProp<ViewStyle>;

  /**
   * Custom label style
   */
  labelStyle?: StyleProp<TextStyle>;

  /**
   * Custom input style
   */
  inputStyle?: InputProps['inputStyle'];

  /**
   * Custom helper text style
   */
  helperTextStyle?: InputProps['helperTextStyle'];

  /**
   * Custom error text style
   */
  errorTextStyle?: InputProps['errorTextStyle'];

  /**
   * Blur handler
   */
  onBlur?: () => void;

  /**
   * Focus handler
   */
  onFocus?: () => void;

  /**
   * Submit handler
   */
  onSubmit?: () => void;

  /**
   * Accessibility props
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}
