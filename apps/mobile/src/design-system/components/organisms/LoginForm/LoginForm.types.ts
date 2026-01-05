/**
 * LoginForm Organism - Type Definitions
 * FormField(email) + FormField(password) + SubmitButton for authentication
 */

import type { BaseComponentProps } from '../../../types';

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginFormProps extends BaseComponentProps {
  /**
   * Initial form values
   */
  initialValues?: Partial<LoginFormData>;

  /**
   * Whether form is in loading state
   */
  loading?: boolean;

  /**
   * Whether form is disabled
   */
  disabled?: boolean;

  /**
   * Form submission handler
   */
  onSubmit: (data: LoginFormData) => void | Promise<void>;

  /**
   * Forgot password handler
   */
  onForgotPassword?: () => void;

  /**
   * Sign up navigation handler
   */
  onSignUp?: () => void;

  /**
   * Social login handlers
   */
  onGoogleLogin?: () => void;
  onAppleLogin?: () => void;
  onFacebookLogin?: () => void;

  /**
   * Form validation errors from server
   */
  errors?: Partial<Record<keyof LoginFormData, string>>;

  /**
   * General form error message
   */
  errorMessage?: string;

  /**
   * Success message
   */
  successMessage?: string;

  /**
   * Whether to show social login options
   */
  showSocialLogin?: boolean;

  /**
   * Whether to show forgot password link
   */
  showForgotPassword?: boolean;

  /**
   * Whether to show sign up link
   */
  showSignUp?: boolean;

  /**
   * Whether to show remember me option
   */
  showRememberMe?: boolean;

  /**
   * Remember me initial value
   */
  rememberMe?: boolean;

  /**
   * Remember me change handler
   */
  onRememberMeChange?: (value: boolean) => void;

  /**
   * Form title
   */
  title?: string;

  /**
   * Form subtitle
   */
  subtitle?: string;

  /**
   * Submit button text
   */
  submitButtonText?: string;

  /**
   * Email field placeholder
   */
  emailPlaceholder?: string;

  /**
   * Password field placeholder
   */
  passwordPlaceholder?: string;

  /**
   * Whether to validate on change
   */
  validateOnChange?: boolean;

  /**
   * Custom validation rules
   */
  validators?: {
    email?: (value: string) => string | null;
    password?: (value: string) => string | null;
  };

  /**
   * Custom container style
   */
  style?: any;

  /**
   * Custom form style
   */
  formStyle?: any;

  /**
   * Custom header style
   */
  headerStyle?: any;

  /**
   * Custom footer style
   */
  footerStyle?: any;

  /**
   * Auto-focus email field on mount
   */
  autoFocus?: boolean;

  /**
   * Accessibility label for the form
   */
  accessibilityLabel?: string;
}
