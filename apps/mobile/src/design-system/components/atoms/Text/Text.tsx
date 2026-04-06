/**
 * Text Component
 * Typography component with theme-aware styling
 */

import React, { forwardRef } from 'react';
import { Text as RNText } from 'react-native';

import { useTheme } from '../../../providers';

import type { TextProps } from './Text.types';
import type { TypographyVariant, UseThemeReturn } from '../../../types';

// Helper function to get style from typography variant
const getVariantStyle = (variant: TypographyVariant, typography: UseThemeReturn['typography']) => {
  const shorthandVariantMap = {
    body: typography.styles.body.medium,
    caption: typography.styles.body.small,
    code: typography.styles.code,
    display: typography.styles.display.medium,
    headline: typography.styles.headline.medium,
    label: typography.styles.label.medium,
    title: typography.styles.title.medium,
    badge: typography.styles.badge,
  } as const;

  if (variant in shorthandVariantMap) {
    return shorthandVariantMap[variant as keyof typeof shorthandVariantMap];
  }

  const [category, sizeToken] = variant.split('.') as [
    'body' | 'display' | 'headline' | 'label' | 'title',
    'large' | 'medium' | 'small' | undefined,
  ];

  if (sizeToken !== undefined) {
    return typography.styles[category][sizeToken];
  }

  return typography.styles.body.medium;
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
      if (sizeValue === undefined) return undefined;

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
      color: color ?? colors.onSurface,

      // Alignment
      textAlign: align,

      // Text decoration
      textDecorationLine: decoration,

      // Text transform
      textTransform: transform,

      // Font weight override (defensive: fontWeight may be undefined during hydration)
      ...(weight !== undefined ? { fontWeight: typography.fontWeight[weight] } : {}),

      // Font size override - now handles both number and string
      ...(size !== undefined ? { fontSize: resolveFontSize(size) } : {}),

      // Line height override
      ...(lineHeight !== undefined ? { lineHeight } : {}),

      // Letter spacing override
      ...(letterSpacing !== undefined ? { letterSpacing } : {}),

      // Italic style
      ...(italic ? { fontStyle: 'italic' as const } : {}),
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
          accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
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
