/**
 * Button Component - Styles
 */

import { StyleSheet } from 'react-native';

import type { ButtonVariant, ButtonSize } from './Button.types';
import type { ThemeContextValue } from '../../../types';

export const createButtonStyles = (
  theme: ThemeContextValue,
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean = false,
  disabled: boolean = false,
) => {
  const { colors, spacing, typography, shadows } = theme;

  // Base button styles
  const baseButton = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    overflow: 'hidden' as const,
    ...shadows.component.button.primary,
  };

  // Size variations
  const sizeStyles = {
    xs: {
      paddingHorizontal: spacing.base.sm,
      paddingVertical: spacing.base.xs,
      minHeight: spacing.sizing.button.sm,
    },
    sm: {
      paddingHorizontal: spacing.base.md,
      paddingVertical: spacing.base.sm,
      minHeight: spacing.sizing.button.sm,
    },
    md: {
      paddingHorizontal: spacing.base.lg,
      paddingVertical: spacing.base.md,
      minHeight: spacing.sizing.button.md,
    },
    lg: {
      paddingHorizontal: spacing.base.lg,
      paddingVertical: spacing.base.sm,
      minHeight: spacing.sizing.button.lg,
    },
    xl: {
      paddingHorizontal: spacing.base['2xl'],
      paddingVertical: spacing.base.lg,
      minHeight: spacing.sizing.button.xl,
    },
  };

  // Variant styles
  const variantStyles = {
    primary: {
      backgroundColor: disabled ? colors.surfaceContainer : colors.primary,
      borderColor: disabled ? colors.outlineVariant : colors.primary,
    },
    secondary: {
      backgroundColor: disabled ? colors.surfaceVariant : colors.secondary,
      borderColor: disabled ? colors.outlineVariant : colors.secondary,
    },
    tertiary: {
      backgroundColor: disabled ? colors.surfaceVariant : colors.surface,
      borderColor: disabled ? colors.outlineVariant : colors.outline,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      ...shadows.none,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: disabled ? colors.outlineVariant : colors.primary,
      ...shadows.none,
    },
    danger: {
      backgroundColor: disabled ? colors.surfaceContainer : colors.error,
      borderColor: disabled ? colors.outlineVariant : colors.error,
    },
    success: {
      backgroundColor: disabled ? colors.surfaceContainer : colors.success,
      borderColor: disabled ? colors.outlineVariant : colors.success,
    },
    text: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      ...shadows.none,
    },
  };

  // Text styles based on variant and size
  const getTextStyle = () => {
    const baseTextStyle = {
      fontFamily: typography.styles.label.medium.fontFamily,
      fontWeight: typography.styles.label.medium.fontWeight,
      letterSpacing: typography.styles.label.medium.letterSpacing,
      textAlign: 'center' as const,
    };

    // Size-based text styles
    const textSizeStyles = {
      xs: {
        fontSize: typography.fontSize.sm, // 12px
        lineHeight: 18, // 12 * 1.5 = 18px
      },
      sm: {
        fontSize: typography.fontSize.sm, // 12px
        lineHeight: 18, // 12 * 1.5 = 18px
      },
      md: {
        fontSize: typography.fontSize.base, // 14px
        lineHeight: 21, // 14 * 1.5 = 21px
      },
      lg: {
        fontSize: typography.fontSize.md, // 16px
        lineHeight: 20, // 16 * 1.5 = 24px
      },
      xl: {
        fontSize: typography.fontSize.lg, // 18px
        lineHeight: 27, // 18 * 1.5 = 27px
      },
    };

    // Variant-based text colors
    const textColorStyles = {
      primary: { color: disabled ? colors.base.neutral[500] : colors.onPrimary },
      secondary: { color: disabled ? colors.base.neutral[500] : colors.onSecondary },
      tertiary: { color: disabled ? colors.base.neutral[500] : colors.onSurface },
      ghost: { color: disabled ? colors.base.neutral[500] : colors.primary },
      outline: { color: disabled ? colors.base.neutral[500] : colors.primary },
      danger: { color: disabled ? colors.base.neutral[500] : colors.onPrimary },
      success: { color: disabled ? colors.base.neutral[500] : colors.onPrimary },
      text: { color: disabled ? colors.base.neutral[500] : colors.primary },
    };

    return {
      ...baseTextStyle,
      ...textSizeStyles[size],
      ...textColorStyles[variant],
    };
  };

  // Platform-specific adjustments - only for elevated button variants
  const shouldHaveElevation = ['primary', 'secondary', 'danger', 'success'].includes(variant);

  // Use cross-platform shadow tokens from the theme — already resolved per platform
  const platformStyles = shouldHaveElevation
    ? { ...(disabled ? shadows.none : shadows.sm) }
    : { ...shadows.none };

  return StyleSheet.create({
    container: {
      ...baseButton,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...platformStyles,
      width: fullWidth ? '100%' : undefined,
      opacity: disabled ? 0.6 : 1,
    },
    text: getTextStyle(),
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainer: {
      marginHorizontal: spacing.base.xs,
    },
    leftIcon: {
      marginEnd: spacing.base.xs,
    },
    rightIcon: {
      marginStart: spacing.base.xs,
    },
  });
};
