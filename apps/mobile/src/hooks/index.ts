/**
 * Hooks - Central Export
 *
 * Export all custom hooks from this file for easier imports
 */

// Redux hooks
export { useAppDispatch, useAppSelector } from './redux';

// Password validation hook
export { usePasswordRules } from './usePasswordRules';
// Server-controlled feature switches (no store release needed to flip one)
export { useFeatureFlags, featureFlagKeys } from './useFeatureFlags';
export type { FeatureFlags } from './useFeatureFlags';
// Location hook
// Phone verification hook
// User profile hook (centralized avatar + display name)
// Secure screen — prevents screenshots/recordings on sensitive screens (Android FLAG_SECURE)

// Add other custom hooks here as they are created
// export { useDebounce } from './useDebounce';
// export { useThrottle } from './useThrottle';
// export { useAsync } from './useAsync';
