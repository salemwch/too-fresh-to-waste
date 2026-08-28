/**
 * Badge Component - Styles
 */

import { StyleSheet } from 'react-native';

import type { BadgeVariant, BadgeSize } from './Badge.types';
import type { ThemeContextValue } from '../../../types';

export const createBadgeStyles = (
  theme: ThemeContextValue,
  variant: BadgeVariant,
  size: BadgeSize,
  outlined: boolean,
  dot: boolean,
  backgroundColor?: string,
  color?: string,
  borderColor?: string,
) => {
  const { colors, spacing, typography } = theme;

  // Size variations
  const sizeStyles = {
    xs: {
      paddingHorizontal: spacing.base.xs,
      paddingVertical: spacing.base.xxs,
      minHeight: spacing.sizing.badge.sm - 4,
      fontSize: typography.fontSize.xs - 2,
      dotSize: 6,
    },
    sm: {
      paddingHorizontal: spacing.base.sm,
      paddingVertical: spacing.base.xs,
      minHeight: spacing.sizing.badge.sm,
      fontSize: typography.fontSize.xs,
      dotSize: 8,
    },
    md: {
      paddingHorizontal: spacing.base.md,
      paddingVertical: spacing.base.sm,
      minHeight: spacing.sizing.badge.md,
      fontSize: typography.fontSize.sm,
      dotSize: 10,
    },
    lg: {
      paddingHorizontal: spacing.base.lg,
      paddingVertical: spacing.base.sm,
      minHeight: spacing.sizing.badge.lg,
      fontSize: typography.fontSize.base,
      dotSize: 12,
    },
    xl: {
      paddingHorizontal: spacing.base.xl,
      paddingVertical: spacing.base.md,
      minHeight: spacing.sizing.badge.lg + 4,
      fontSize: typography.fontSize.md,
      dotSize: 14,
    },
  };

  // Variant color mappings
  const variantColorMap = {
    default: {
      bg: colors.surfaceContainer,
      text: colors.onSurface,
      border: colors.outlineVariant,
    },
    primary: {
      bg: colors.primary,
      text: colors.onPrimary,
      border: colors.primary,
    },
    secondary: {
      bg: colors.secondary,
      text: colors.onSecondary,
      border: colors.secondary,
    },
    success: {
      bg: colors.success,
      text: '#FFFFFF',
      border: colors.success,
    },
    error: {
      bg: colors.error,
      text: '#FFFFFF',
      border: colors.error,
    },
    warning: {
      bg: colors.warning,
      text: '#000000',
      border: colors.warning,
    },
    info: {
      bg: colors.info,
      text: '#FFFFFF',
      border: colors.info,
    },
    neutral: {
      bg: colors.neutral[200],
      text: colors.neutral[900],
      border: colors.neutral[400],
    },
  };

  const variantColors = variantColorMap[variant];

  // Determine final colors
  const finalBg = backgroundColor ?? (outlined ? 'transparent' : variantColors.bg);
  const finalText = color ?? variantColors.text;
  const finalBorder = borderColor ?? variantColors.border;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: finalBg,
      borderRadius: dot ? sizeStyles[size].dotSize / 2 : spacing.radius.full,
      ...(dot
        ? {
            width: sizeStyles[size].dotSize,
            height: sizeStyles[size].dotSize,
          }
        : {
            paddingHorizontal: sizeStyles[size].paddingHorizontal,
            paddingVertical: sizeStyles[size].paddingVertical,
            minHeight: sizeStyles[size].minHeight,
          }),
      ...(outlined && {
        borderWidth: 1,
        borderColor: finalBorder,
      }),
    },
    text: {
      fontFamily: typography.styles.badge.fontFamily,
      fontSize: sizeStyles[size].fontSize,
      fontWeight: typography.styles.badge.fontWeight,
      letterSpacing: typography.styles.badge.letterSpacing,
      textTransform: typography.styles.badge.textTransform,
      color: finalText,
      lineHeight: sizeStyles[size].fontSize * 1.2,
    },
    leftIcon: {
      marginEnd: spacing.base.xs,
    },
    rightIcon: {
      marginStart: spacing.base.xs,
    },
    closeButton: {
      marginStart: spacing.base.xs,
      padding: spacing.base.xxs,
    },
  });
};
