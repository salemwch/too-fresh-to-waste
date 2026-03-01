/**
 * Avatar Component - Styles
 */

import { StyleSheet } from 'react-native';

import type { AvatarSize, AvatarVariant } from './Avatar.types';
import type { ThemeContextValue } from '../../../types';

export const getAvatarSize = (size: AvatarSize, theme: ThemeContextValue): number => {
  if (typeof size === 'number') {
    return size;
  }

  const sizeMap = {
    xs: theme.spacing.sizing.avatar.sm - 8,
    sm: theme.spacing.sizing.avatar.sm,
    md: theme.spacing.sizing.avatar.md,
    lg: theme.spacing.sizing.avatar.lg,
    xl: theme.spacing.sizing.avatar.lg + 16,
  };

  return sizeMap[size];
};

export const getAvatarBorderRadius = (
  variant: AvatarVariant,
  size: number,
  theme: ThemeContextValue,
): number => {
  switch (variant) {
    case 'circular':
      return size / 2;
    case 'rounded':
      return theme.spacing.radius.lg;
    case 'square':
      return theme.spacing.radius.sm;
    default:
      return size / 2;
  }
};

export const createAvatarStyles = (
  theme: ThemeContextValue,
  size: number,
  variant: AvatarVariant,
  backgroundColor?: string,
  borderColor?: string,
  borderWidth?: number,
) => {
  const { colors, typography } = theme;

  const borderRadius = getAvatarBorderRadius(variant, size, theme);

  // Calculate font size based on avatar size
  const fontSize = size * 0.4;

  return StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius,
      backgroundColor: backgroundColor || colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      ...(borderColor &&
        borderWidth && {
          borderColor,
          borderWidth,
        }),
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius,
    },
    initialsContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    initialsText: {
      fontFamily: typography.fontFamily.primary,
      fontSize,
      fontWeight: typography.fontWeight?.semibold ?? '600',
      color: colors.onPrimary,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    iconContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius,
    },
    statusIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: size * 0.25,
      height: size * 0.25,
      borderRadius: (size * 0.25) / 2,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    statusOnline: {
      backgroundColor: colors.success,
    },
    statusOffline: {
      backgroundColor: colors.neutral[400],
    },
    statusAway: {
      backgroundColor: colors.warning,
    },
    statusBusy: {
      backgroundColor: colors.error,
    },
  });
};
