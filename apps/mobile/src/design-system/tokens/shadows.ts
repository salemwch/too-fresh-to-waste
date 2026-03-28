/**
 * Design System - Shadow Tokens
 * Platform-specific elevation and shadow system
 */

import { Platform } from 'react-native';

// iOS Shadow Tokens - Uses shadowColor, shadowOffset, shadowOpacity, shadowRadius
const iosShadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },

  xs: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },

  '2xl': {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
} as const;

// Android Elevation Tokens - Uses elevation property
const androidElevations = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  '2xl': 16,
} as const;

// Cross-platform shadow system
// Using non-null assertion since Platform.select always returns a value (has default)
const shadows = Platform.select({
  ios: {
    none: iosShadows.none,
    xs: iosShadows.xs,
    sm: iosShadows.sm,
    md: iosShadows.md,
    lg: iosShadows.lg,
    xl: iosShadows.xl,
    '2xl': iosShadows['2xl'],
  },
  android: {
    none: { elevation: androidElevations.none },
    xs: { elevation: androidElevations.xs },
    sm: { elevation: androidElevations.sm },
    md: { elevation: androidElevations.md },
    lg: { elevation: androidElevations.lg },
    xl: { elevation: androidElevations.xl },
    '2xl': { elevation: androidElevations['2xl'] },
  },
  default: iosShadows, // Fallback to iOS shadows for web/other platforms
});

// Component-specific shadow presets
const componentShadows = {
  // Card shadows
  card: {
    resting: shadows.sm,
    elevated: shadows.md,
    pressed: shadows.xs,
  },

  // Button shadows
  button: {
    primary: shadows.sm,
    secondary: shadows.xs,
    pressed: shadows.none,
  },

  // Modal/Overlay shadows
  modal: {
    backdrop: shadows.xl,
    sheet: shadows.lg,
  },

  // Navigation shadows
  navigation: {
    header: shadows.sm,
    tabBar: shadows.md,
  },

  // Food-specific shadows
  food: {
    offer: shadows.sm,
    featured: shadows.md,
    image: shadows.xs,
  },

  // Input shadows
  input: {
    default: shadows.xs,
    focused: shadows.sm,
    error: shadows.sm,
  },

  // Floating action button
  fab: shadows.lg,

  // Toast/Snackbar
  toast: shadows.md,
} as const;

// Dark theme shadow adjustments
// Using non-null assertion since Platform.select always returns a value (has default)
const darkShadows = Platform.select({
  ios: {
    none: iosShadows.none,
    xs: {
      ...iosShadows.xs,
      shadowColor: '#000000',
      shadowOpacity: 0.8,
    },
    sm: {
      ...iosShadows.sm,
      shadowColor: '#000000',
      shadowOpacity: 0.8,
    },
    md: {
      ...iosShadows.md,
      shadowColor: '#000000',
      shadowOpacity: 0.8,
    },
    lg: {
      ...iosShadows.lg,
      shadowColor: '#000000',
      shadowOpacity: 0.8,
    },
    xl: {
      ...iosShadows.xl,
      shadowColor: '#000000',
      shadowOpacity: 0.8,
    },
    '2xl': {
      ...iosShadows['2xl'],
      shadowColor: '#000000',
      shadowOpacity: 0.8,
    },
  },
  android: {
    // Android elevation works the same in dark mode
    none: { elevation: androidElevations.none },
    xs: { elevation: androidElevations.xs },
    sm: { elevation: androidElevations.sm },
    md: { elevation: androidElevations.md },
    lg: { elevation: androidElevations.lg },
    xl: { elevation: androidElevations.xl },
    '2xl': { elevation: androidElevations['2xl'] },
  },
  default: {
    // Enhanced shadows for dark mode on other platforms
    none: iosShadows.none,
    xs: { ...iosShadows.xs, shadowOpacity: 0.8 },
    sm: { ...iosShadows.sm, shadowOpacity: 0.8 },
    md: { ...iosShadows.md, shadowOpacity: 0.8 },
    lg: { ...iosShadows.lg, shadowOpacity: 0.8 },
    xl: { ...iosShadows.xl, shadowOpacity: 0.8 },
    '2xl': { ...iosShadows['2xl'], shadowOpacity: 0.8 },
  },
});

// Utility function to get platform-appropriate shadow
const getShadow = (level: keyof typeof shadows, isDark = false) =>
  isDark ? darkShadows[level] : shadows[level];

// Export all shadow tokens
export const shadowTokens = {
  ios: iosShadows,
  android: androidElevations,
  cross: shadows,
  dark: darkShadows,
  component: componentShadows,
  getShadow,
} as const;

// Type definitions
export type IosShadows = typeof iosShadows;
export type AndroidElevations = typeof androidElevations;
export type Shadows = typeof shadows;
export type ComponentShadows = typeof componentShadows;
export type ShadowTokens = typeof shadowTokens;
