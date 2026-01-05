/**
 * Design System - Main Index
 * Central export for the entire design system
 */

// Design tokens
export * from './tokens';

// Types
export * from './types';

// Providers
export * from './providers';

// Components
export * from './components';

// Utilities (to be implemented)
// export * from './utils';

// Main design system object for easy access
export { designTokens } from './tokens';
export { ThemeProvider, useTheme, useThemedStyles } from './providers';
