/**
 * Hooks - Central Export
 *
 * Export all custom hooks from this file for easier imports
 */

// Redux hooks
export { useAppDispatch, useAppSelector, useAppStore } from './redux';

// Password validation hook
export { usePasswordRules } from './usePasswordRules';
export type { PasswordRule, PasswordStrength, PasswordValidationResult } from './usePasswordRules';

// Location hook
export { useLocation } from './useLocation';
export type {
  UseLocationReturn,
  LocationCoordinates,
  LocationResult,
  LocationSource,
  PermissionStatus,
} from './useLocation';

// Phone verification hook
export { usePhoneVerification } from './usePhoneVerification';

// User profile hook (centralized avatar + display name)
export { useUserProfile } from './useUserProfile';

// Secure screen — prevents screenshots/recordings on sensitive screens (Android FLAG_SECURE)
export { useSecureScreen } from './useSecureScreen';

// Add other custom hooks here as they are created
// export { useDebounce } from './useDebounce';
// export { useThrottle } from './useThrottle';
// export { useAsync } from './useAsync';
