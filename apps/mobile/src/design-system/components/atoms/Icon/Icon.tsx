/**
 * Icon Component
 * Flexible icon component using react-native-vector-icons
 */

import IoniconsIcon from '@react-native-vector-icons/ionicons';
import React, { forwardRef } from 'react';
import { I18nManager, View } from 'react-native';

import { useTheme } from '../../../providers';

import { createIconStyles, getIconSize } from './Icon.styles';
import { mirrorIconName } from './rtlMirror';

import type { IconProps } from './Icon.types';

export const Icon = forwardRef<View, IconProps>(
  (
    {
      name,
      size = 'md',
      color,
      variant: _variant = 'default',
      family: _family = 'Ionicons',
      disabled = false,
      mirrorInRTL = true,
      backgroundColor,
      borderRadius,
      padding,
      style,
      containerStyle,
      testID,
      accessibilityLabel,
      accessibilityHint,
      accessibilityRole = 'image',
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme();
    const { colors } = theme;

    // Calculate icon size
    const iconSize = getIconSize(size, theme);

    // Create styles
    const styles = createIconStyles(
      theme,
      iconSize,
      disabled,
      backgroundColor,
      borderRadius,
      padding,
    );

    // Determine icon color
    const iconColor = color ?? colors.onSurface;

    const IconComponent = IoniconsIcon;

    // RTL mirrors the layout but not the glyph, so a back chevron ends up on
    // the correct side still pointing the wrong way. See ./rtlMirror.ts.
    const resolvedName = mirrorInRTL ? mirrorIconName(name, I18nManager.isRTL) : name;

    return (
      <View
        ref={ref}
        style={[styles.container, containerStyle]}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? name}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole}
        {...rest}
      >
        <IconComponent
          name={resolvedName as React.ComponentProps<typeof IoniconsIcon>['name']}
          size={iconSize}
          color={iconColor}
          style={[styles.icon, style]}
          suppressHighlighting
        />
      </View>
    );
  },
);

Icon.displayName = 'Icon';
