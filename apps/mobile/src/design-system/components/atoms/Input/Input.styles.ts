/**
 * Input Component - Styles
 */

import { Platform, StyleSheet } from 'react-native';

import type { InputVariant, InputSize, InputState } from './Input.types';
import type { ThemeContextValue } from '../../../types';

export const createInputStyles = (
  theme: ThemeContextValue,
  variant: InputVariant,
  size: InputSize,
  state: InputState,
  fullWidth: boolean = false,
  hasLeftIcon: boolean = false,
  hasRightIcon: boolean = false,
) => {
  const { colors, spacing, typography, shadows } = theme;

  // Size variations
  const sizeStyles = {
    xs: {
      paddingHorizontal: spacing.base.sm,
      paddingVertical: spacing.base.xs,
      minHeight: spacing.sizing.input.sm - 8,
      fontSize: typography.fontSize.sm,
    },
    sm: {
      paddingHorizontal: spacing.base.md,
      paddingVertical: spacing.base.sm,
      minHeight: spacing.sizing.input.sm,
      fontSize: typography.fontSize.sm,
    },
    md: {
      paddingHorizontal: spacing.base.md,
      paddingVertical: spacing.base.md,
      minHeight: spacing.sizing.input.md,
      fontSize: typography.fontSize.base,
    },
    lg: {
      paddingHorizontal: spacing.base.lg,
      paddingVertical: spacing.base.md,
      minHeight: spacing.sizing.input.lg,
      fontSize: typography.fontSize.md,
    },
    xl: {
      paddingHorizontal: spacing.base.lg,
      paddingVertical: spacing.base.lg,
      minHeight: spacing.sizing.input.lg + 8,
      fontSize: typography.fontSize.lg,
    },
  };

  // Variant styles
  const variantStyles = {
    default: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor:
        state === 'error'
          ? colors.error
          : state === 'focused'
            ? colors.primary
            : state === 'disabled'
              ? colors.base.neutral[300]
              : colors.outline,
      borderRadius: spacing.radius.md,
    },
    filled: {
      backgroundColor:
        state === 'focused'
          ? colors.surfaceVariant
          : state === 'disabled'
            ? colors.base.neutral[100]
            : colors.surfaceContainer,
      borderWidth: 0,
      borderBottomWidth: 2,
      borderBottomColor:
        state === 'error'
          ? colors.error
          : state === 'focused'
            ? colors.primary
            : state === 'disabled'
              ? colors.base.neutral[300]
              : colors.outline,
      borderRadius: spacing.radius.sm,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    outlined: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor:
        state === 'error'
          ? colors.error
          : state === 'focused'
            ? colors.primary
            : state === 'disabled'
              ? colors.base.neutral[300]
              : colors.outline,
      borderRadius: spacing.radius.md,
    },
  };

  // State-specific adjustments
  const stateStyles = {
    default: {},
    focused: {
      ...shadows.component.input.focused,
    },
    error: {
      ...shadows.component.input.error,
    },
    disabled: {
      opacity: 0.6,
    },
  };

  // Platform-specific adjustments
  const platformStyles = Platform.select({
    ios: {
      // iOS-specific input styles
      shadowColor: state === 'focused' ? colors.primary : 'transparent',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: state === 'focused' ? 0.1 : 0,
      shadowRadius: 4,
    },
    android: {
      // Android-specific input styles
      elevation: state === 'focused' ? 2 : 0,
    },
    default: {},
  });

  // Text styles
  const textStyle = {
    fontFamily: typography.styles.body.medium.fontFamily,
    fontSize: sizeStyles[size].fontSize,
    fontWeight: typography.styles.body.medium.fontWeight,
    lineHeight: typography.styles.body.medium.lineHeight, // Already absolute pixels (21), no multiplication needed
    color: state === 'disabled' ? colors.onSurfaceVariant : colors.base.neutral[900], // Darker color for better visibility
    flex: 1,
    textAlignVertical: 'center' as const,
    includeFontPadding: false,
  };

  // Label styles
  const labelStyle = {
    fontFamily: typography.styles.label.medium.fontFamily,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.styles.label.medium.fontWeight,
    color:
      state === 'error'
        ? colors.error
        : state === 'focused'
          ? colors.primary
          : colors.onSurfaceVariant,
    marginBottom: spacing.base.xs,
  };

  // Helper/Error text styles
  const helperTextStyle = {
    fontFamily: typography.styles.body.small.fontFamily,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.styles.body.small.fontWeight,
    color: state === 'error' ? colors.error : colors.onSurfaceVariant,
    marginTop: spacing.base.xs,
    lineHeight: typography.styles.body.small.lineHeight, // Use body.small lineHeight directly (18px)
  };

  return StyleSheet.create({
    container: {
      width: fullWidth ? '100%' : undefined,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      // A flex child is flexShrink: 0 by default in React Native, so at an
      // enlarged font scale the label kept its intrinsic width and was clipped
      // by the row - "Password" rendered as "Passw". Wrapping is the correct
      // behaviour for a form label; truncating it is not.
      flexWrap: 'wrap',
    },
    label: { ...labelStyle, flexShrink: 1 },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: sizeStyles[size].minHeight, // Fixed height, not minHeight
      ...variantStyles[variant],
      ...stateStyles[state],
      ...platformStyles,
      paddingVertical: 0, // Remove vertical padding to maintain exact height
      paddingStart: hasLeftIcon ? spacing.base.sm : sizeStyles[size].paddingHorizontal,
      paddingEnd: hasRightIcon ? spacing.base.sm : sizeStyles[size].paddingHorizontal,
      overflow: 'hidden', // Prevent children from overflowing
    },
    input: {
      ...textStyle,
      paddingHorizontal: 0,
      paddingVertical: 0, // Remove vertical padding - let textAlignVertical center the text
      margin: 0,
      height: '100%', // Take full height of container
      minWidth: 0, // Allow input to shrink below content width
    },
    leftIconContainer: {
      marginEnd: spacing.base.sm,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0, // Prevent icon from shrinking
      height: sizeStyles[size].minHeight, // Fixed height matching container
    },
    rightIconContainer: {
      marginStart: spacing.base.sm,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0, // Prevent icon from shrinking
      height: sizeStyles[size].minHeight, // Fixed height matching container
    },
    helperText: helperTextStyle,
    errorText: {
      ...helperTextStyle,
      color: colors.error,
    },
    requiredAsterisk: {
      color: colors.error,
      fontSize: typography.fontSize.sm,
    },
  });
};
