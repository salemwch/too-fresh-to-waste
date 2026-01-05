/**
 * Icon Component - Styles
 */

import { StyleSheet } from 'react-native';

import type { IconSize } from './Icon.types';
import type { ThemeContextValue } from '../../../types';

export const getIconSize = (size: IconSize, theme: ThemeContextValue): number => {
  if (typeof size === 'number') {
    return size;
  }

  const sizeMap = {
    xs: theme.spacing.sizing.icon.sm - 8,
    sm: theme.spacing.sizing.icon.sm,
    md: theme.spacing.sizing.icon.md,
    lg: theme.spacing.sizing.icon.lg,
    xl: theme.spacing.sizing.icon.lg + 8,
  };

  return sizeMap[size];
};

export const createIconStyles = (
  theme: ThemeContextValue,
  size: number,
  disabled: boolean,
  backgroundColor?: string,
  borderRadius?: number,
  padding?: number,
) => {
  const { spacing } = theme;

  return StyleSheet.create({
    container: {
      justifyContent: 'center',
      alignItems: 'center',
      ...(backgroundColor && {
        backgroundColor,
        borderRadius: borderRadius ?? spacing.radius.full,
        padding: padding ?? spacing.base.sm,
      }),
      ...(disabled && {
        opacity: 0.5,
      }),
    },
    icon: {
      width: size,
      height: size,
      textAlign: 'center',
      textAlignVertical: 'center',
      ...(disabled && {
        opacity: 0.5,
      }),
    },
  });
};
