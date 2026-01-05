/**
 * Text Component - Styles
 * Provides theme-aware text styling utilities
 */

import { StyleSheet } from 'react-native';

import type { ThemeContextValue } from '../../../types';

export const createTextStyles = (theme: ThemeContextValue) => {
  const { colors, typography } = theme;

  return StyleSheet.create({
    // Base text style
    base: {
      color: colors.onSurface,
      fontFamily: typography.fontFamily.secondary,
    },

    // Color variants
    primary: {
      color: colors.primary,
    },
    secondary: {
      color: colors.secondary,
    },
    error: {
      color: colors.error,
    },
    success: {
      color: colors.success,
    },
    warning: {
      color: colors.warning,
    },
    info: {
      color: colors.info,
    },
    onBackground: {
      color: colors.onBackground,
    },
    onSurface: {
      color: colors.onSurface,
    },
    onSurfaceVariant: {
      color: colors.onSurfaceVariant,
    },

    // Text alignment
    left: {
      textAlign: 'left' as const,
    },
    center: {
      textAlign: 'center' as const,
    },
    right: {
      textAlign: 'right' as const,
    },
    justify: {
      textAlign: 'justify' as const,
    },

    // Text decoration
    underline: {
      textDecorationLine: 'underline' as const,
    },
    lineThrough: {
      textDecorationLine: 'line-through' as const,
    },
    none: {
      textDecorationLine: 'none' as const,
    },

    // Text transform
    uppercase: {
      textTransform: 'uppercase' as const,
    },
    lowercase: {
      textTransform: 'lowercase' as const,
    },
    capitalize: {
      textTransform: 'capitalize' as const,
    },

    // Font weights
    thin: {
      fontWeight: typography.fontWeight.thin,
    },
    light: {
      fontWeight: typography.fontWeight.light,
    },
    regular: {
      fontWeight: typography.fontWeight.regular,
    },
    medium: {
      fontWeight: typography.fontWeight.medium,
    },
    semibold: {
      fontWeight: typography.fontWeight.semibold,
    },
    bold: {
      fontWeight: typography.fontWeight.bold,
    },
    extrabold: {
      fontWeight: typography.fontWeight.extrabold,
    },
    black: {
      fontWeight: typography.fontWeight.black,
    },

    // Italic
    italic: {
      fontStyle: 'italic' as const,
    },
  });
};

// Helper to get text color based on color scheme
export const getTextColor = (colorName: string | undefined, theme: ThemeContextValue): string => {
  if (!colorName) return theme.colors.onSurface;

  const colorMap: Record<string, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    error: theme.colors.error,
    success: theme.colors.success,
    warning: theme.colors.warning,
    info: theme.colors.info,
    onBackground: theme.colors.onBackground,
    onSurface: theme.colors.onSurface,
    onSurfaceVariant: theme.colors.onSurfaceVariant,
  };

  return colorMap[colorName] || theme.colors.onSurface;
};
