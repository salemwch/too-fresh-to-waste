/**
 * Card Component - Styles
 */

import { Platform, StyleSheet, type ViewStyle } from 'react-native';

import type { CardVariant, CardSize } from './Card.types';
import type { ThemeContextValue } from '../../../types';

export const createCardStyles = (
  theme: ThemeContextValue,
  variant: CardVariant,
  size: CardSize,
  disabled: boolean = false,
) => {
  const { colors, spacing, shadows } = theme;

  // Size variations
  const sizeStyles = {
    sm: {
      padding: spacing.base.sm,
      borderRadius: spacing.radius.sm,
    },
    md: {
      padding: spacing.base.md,
      borderRadius: spacing.radius.md,
    },
    lg: {
      padding: spacing.base.lg,
      borderRadius: spacing.radius.lg,
    },
  };

  // Variant styles
  const variantStyles = {
    default: {
      backgroundColor: colors.surface,
      borderWidth: 0,
      ...shadows.component.card.resting,
    },
    elevated: {
      backgroundColor: colors.surface,
      borderWidth: 0,
      ...shadows.component.card.elevated,
    },
    outlined: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
      ...(Platform.OS === 'ios' ? shadows.none : Platform.OS === 'android' ? { elevation: 0 } : {}),
    },
    filled: {
      backgroundColor: colors.surfaceVariant,
      borderWidth: 0,
      ...(Platform.OS === 'ios' ? shadows.none : Platform.OS === 'android' ? { elevation: 0 } : {}),
    },
  };

  // Base card styles with proper typing
  const baseCard: ViewStyle = {
    overflow: 'hidden' as const,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  // Disabled state adjustments
  if (disabled) {
    baseCard.opacity = 0.6;
  }

  // Platform-specific adjustments
  const platformStyles = Platform.select({
    ios: {
      // iOS uses shadow properties
    },
    android: {
      // Android uses elevation
    },
    default: {},
  });

  return StyleSheet.create({
    container: {
      ...baseCard,
      ...platformStyles,
    },
    pressable: {
      ...baseCard,
      ...platformStyles,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay.light,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: sizeStyles[size].borderRadius,
    },
  });
};

// Pressed state styles for pressable cards
export const createPressedCardStyles = (theme: ThemeContextValue, variant: CardVariant) => {
  const { colors, shadows } = theme;

  const pressedVariantStyles = {
    default: {
      ...shadows.component.card.pressed,
    },
    elevated: {
      ...shadows.component.card.pressed,
    },
    outlined: {
      backgroundColor: colors.surfaceVariant,
    },
    filled: {
      backgroundColor: colors.surfaceContainer,
    },
  };

  return pressedVariantStyles[variant];
};
