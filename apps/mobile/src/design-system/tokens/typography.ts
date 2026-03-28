/**
 * Design System - Typography Tokens
 * Platform-specific typography system following iOS HIG and Material Design
 */

import { Platform } from 'react-native';

// Font Family Tokens
const fontFamily = {
  primary: Platform.select({
    ios: 'SF Pro Display',
    android: 'Roboto',
    default: 'System',
  }),

  secondary: Platform.select({
    ios: 'SF Pro Text',
    android: 'Roboto',
    default: 'System',
  }),

  mono: Platform.select({
    ios: 'SF Mono',
    android: 'Roboto Mono',
    default: 'monospace',
  }),
} as const;

// Font Weight Tokens
const fontWeight = {
  thin: '100' as const,
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
} as const;

// Font Size Scale - Following 8pt grid system
const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 36,
  '6xl': 42,
  '7xl': 48,
} as const;

// Line Height Scale - Optimized for readability
// Note: React Native on Android needs higher lineHeight than web/iOS to prevent text clipping
const lineHeight = {
  none: 1,
  tight: 1.25, // Increased from 1.2 to prevent text clipping on Android
  snug: 1.4, // Increased from 1.3 to prevent text clipping on Android
  normal: 1.5, // Increased from 1.4 for better readability
  relaxed: 1.6,
  loose: 1.8,
  extraLoose: 2,
} as const;

// Letter Spacing - Platform-specific adjustments
const letterSpacing = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  widest: 1,
} as const;

// Typography Styles - Semantic Design Tokens
const typographyStyles = {
  // Display Styles - Large headers, hero text
  display: {
    large: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize['7xl'], // 48px
      fontWeight: fontWeight.bold,
      lineHeight: 60, // Absolute pixels (48 * 1.25 = 60)
      letterSpacing: letterSpacing.tight,
    },
    medium: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize['6xl'], // 42px
      fontWeight: fontWeight.bold,
      lineHeight: 52, // Absolute pixels (42 * 1.24 = 52)
      letterSpacing: letterSpacing.tight,
    },
    small: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize['5xl'], // 36px
      fontWeight: fontWeight.semibold,
      lineHeight: 50, // Absolute pixels (36 * 1.4 = 50)
      letterSpacing: letterSpacing.normal,
    },
  },

  // Headline Styles - Page titles, section headers
  headline: {
    large: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize['4xl'], // 32px
      fontWeight: fontWeight.semibold,
      lineHeight: 48, // Absolute pixels for React Native (32 * 1.5 = 48)
      letterSpacing: letterSpacing.normal,
    },
    medium: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize['3xl'], // 28px
      fontWeight: fontWeight.semibold,
      lineHeight: 42, // Absolute pixels (28 * 1.5 = 42)
      letterSpacing: letterSpacing.normal,
    },
    small: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize['2xl'], // 24px
      fontWeight: fontWeight.medium,
      lineHeight: 36, // Absolute pixels (24 * 1.5 = 36)
      letterSpacing: letterSpacing.normal,
    },
  },

  // Title Styles - Card titles, component headers
  title: {
    large: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.xl, // 20px
      fontWeight: fontWeight.medium,
      lineHeight: 30, // Absolute pixels (20 * 1.5 = 30)
      letterSpacing: letterSpacing.normal,
    },
    medium: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.lg, // 18px
      fontWeight: fontWeight.medium,
      lineHeight: 27, // Absolute pixels (18 * 1.5 = 27)
      letterSpacing: letterSpacing.normal,
    },
    small: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.md, // 16px
      fontWeight: fontWeight.medium,
      lineHeight: 24, // Absolute pixels (16 * 1.5 = 24)
      letterSpacing: letterSpacing.wide,
    },
  },

  // Body Styles - Main content text
  body: {
    large: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.md, // 16px
      fontWeight: fontWeight.regular,
      lineHeight: 24, // Absolute pixels (16 * 1.5 = 24)
      letterSpacing: letterSpacing.normal,
    },
    medium: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.base, // 14px
      fontWeight: fontWeight.regular,
      lineHeight: 21, // Absolute pixels (14 * 1.5 = 21)
      letterSpacing: letterSpacing.normal,
    },
    small: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.sm, // 12px
      fontWeight: fontWeight.regular,
      lineHeight: 18, // Absolute pixels (12 * 1.5 = 18)
      letterSpacing: letterSpacing.normal,
    },
  },

  // Label Styles - Form labels, buttons, small UI text
  label: {
    large: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.wide,
    },
    medium: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.wide,
    },
    small: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.wider,
    },
  },

  // Food-Specific Typography
  price: {
    original: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.regular,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
      textDecorationLine: 'line-through' as const,
    },
    discounted: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    savings: {
      fontFamily: fontFamily.secondary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
  },

  // Status & Badge Typography
  badge: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.none,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase' as const,
  },

  // Code & Monospace
  code: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
} as const;

// Platform-specific adjustments
const platformTypography = {
  ios: {
    // iOS uses different line height calculations
    adjustments: {
      lineHeightMultiplier: 1.1,
      baseFontSize: 17, // iOS default body text size
    },

    // iOS-specific text styles
    navigation: {
      title: {
        fontFamily: fontFamily.primary,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
        lineHeight: lineHeight.snug,
      },

      largeTitle: {
        fontFamily: fontFamily.primary,
        fontSize: fontSize['4xl'],
        fontWeight: fontWeight.bold,
        lineHeight: lineHeight.tight,
      },
    },
  },

  android: {
    // Android Material Design text styles
    adjustments: {
      lineHeightMultiplier: 1.0,
      baseFontSize: 16, // Material Design default
    },

    // Material Design text styles
    navigation: {
      title: {
        fontFamily: fontFamily.primary,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.medium,
        lineHeight: lineHeight.normal,
      },
    },
  },
} as const;

// Export all typography tokens
export const typographyTokens = {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
  styles: typographyStyles,
  platform: platformTypography,
} as const;

// Type definitions
export type FontFamily = typeof fontFamily;
export type FontWeight = typeof fontWeight;
export type FontSize = typeof fontSize;
export type TypographyStyles = typeof typographyStyles;
export type TypographyTokens = typeof typographyTokens;
