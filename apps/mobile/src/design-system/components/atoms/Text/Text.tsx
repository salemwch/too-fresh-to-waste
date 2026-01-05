/**
 * Text Component
 * Typography component with theme-aware styling
 */

import React, { forwardRef } from 'react';
import { Text as RNText } from 'react-native';

import { useTheme } from '../../../providers';

import type { TextProps } from './Text.types';
import type { TypographyVariant } from '../../../types';

// Helper function to get style from typography variant
const getVariantStyle = (variant: TypographyVariant, typography: any) => {
  const parts = variant.split('.');

  if (parts.length === 2) {
    const [category, size] = parts;
    // Type guard to ensure category and size are defined
    if (category && size && typography.styles[category]) {
      return typography.styles[category][size] || typography.styles.body.medium;
    }
  }

  // Handle special variants
  switch (variant) {
    case 'badge':
      return typography.styles.badge;
    case 'code':
      return typography.styles.code;
    default:
      return typography.styles.body.medium;
  }
};

export const Text = forwardRef<RNText, TextProps>(
  (
    {
      variant = 'body.medium',
      color,
      align = 'left',
      decoration = 'none',
      transform = 'none',
      weight,
      size,
      lineHeight,
      letterSpacing,
      italic = false,
      numberOfLines,
      ellipsizeMode = 'tail',
      selectable = false,
      style,
      children,
      testID,
      accessibilityLabel,
      accessibilityHint,
      accessibilityRole = 'text',
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme();
    const { colors, typography } = theme;

    // Get base style from variant
    const variantStyle = getVariantStyle(variant, typography);

    // Resolve fontSize - accept both number and fontSize token key (string)
    const resolveFontSize = (sizeValue: typeof size): number | undefined => {
      if (!sizeValue) return undefined;

      // If it's a number, return as-is
      if (typeof sizeValue === 'number') return sizeValue;

      // If it's a string, look it up in typography.fontSize
      return typography.fontSize[sizeValue];
    };

    // Build complete text style
    const textStyle = {
      // Base variant styles
      ...variantStyle,

      // Color override
      color: color || colors.onSurface,

      // Alignment
      textAlign: align,

      // Text decoration
      textDecorationLine: decoration,

      // Text transform
      textTransform: transform,

      // Font weight override
      ...(weight && { fontWeight: typography.fontWeight[weight] }),

      // Font size override - now handles both number and string
      ...(size && { fontSize: resolveFontSize(size) }),

      // Line height override
      ...(lineHeight && { lineHeight }),

      // Letter spacing override
      ...(letterSpacing && { letterSpacing }),

      // Italic style
      ...(italic && { fontStyle: 'italic' }),
    };

    return (
      <RNText
        ref={ref}
        style={[textStyle, style]}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        selectable={selectable}
        testID={testID}
        accessibilityLabel={
          accessibilityLabel || (typeof children === 'string' ? children : undefined)
        }
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole}
        {...rest}
      >
        {children}
      </RNText>
    );
  },
);

Text.displayName = 'Text';

export default Text;
