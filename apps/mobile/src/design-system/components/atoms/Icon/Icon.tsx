/**
 * Icon Component
 * Flexible icon component using react-native-vector-icons
 */

import React, { forwardRef } from 'react';
import { View } from 'react-native';
import AntDesign from '@react-native-vector-icons/ant-design';
import Entypo from '@react-native-vector-icons/entypo';
import EvilIcons from '@react-native-vector-icons/evil-icons';
import Feather from '@react-native-vector-icons/feather';
import FontAwesome from '@react-native-vector-icons/fontawesome';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import FontAwesome6 from '@react-native-vector-icons/fontawesome6';
import Fontisto from '@react-native-vector-icons/fontisto';
import Foundation from '@react-native-vector-icons/foundation';
import Ionicons from '@react-native-vector-icons/ionicons';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Octicons from '@react-native-vector-icons/octicons';
import SimpleLineIcons from '@react-native-vector-icons/simple-line-icons';
import Zocial from '@react-native-vector-icons/zocial';

import { useTheme } from '../../../providers';

import { createIconStyles, getIconSize } from './Icon.styles';

import type { IconProps } from './Icon.types';
import type { IconComponent } from '../../../types';

export const Icon = forwardRef<View, IconProps>(
  function Icon(
    {
      name,
      size = 'md',
      color,
      variant = 'default',
      family = 'MaterialIcons',
      disabled = false,
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
  ) {
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
    const iconColor = color || colors.onSurface;

    /**
     * Get appropriate icon component based on family
     * Uses shared IconComponent type for type safety
     */
    const getIconComponent = (): IconComponent => {
      switch (family) {
        case 'AntDesign':
          return AntDesign as IconComponent;
        case 'Entypo':
          return Entypo as IconComponent;
        case 'EvilIcons':
          return EvilIcons as IconComponent;
        case 'Feather':
          return Feather as IconComponent;
        case 'FontAwesome':
          return FontAwesome as IconComponent;
        case 'FontAwesome5':
          return FontAwesome5 as IconComponent;
        case 'FontAwesome6':
          return FontAwesome6 as IconComponent;
        case 'Fontisto':
          return Fontisto as IconComponent;
        case 'Foundation':
          return Foundation as IconComponent;
        case 'MaterialCommunityIcons':
          return MaterialCommunityIcons as IconComponent;
        case 'MaterialIcons':
          return MaterialIcons as IconComponent;
        case 'Octicons':
          return Octicons as IconComponent;
        case 'SimpleLineIcons':
          return SimpleLineIcons as IconComponent;
        case 'Zocial':
          return Zocial as IconComponent;
        case 'Ionicons':
        default:
          return Ionicons as IconComponent;
      }
    };

    const IconComponent = getIconComponent();

    return (
      <View
        ref={ref}
        style={[styles.container, containerStyle]}
        testID={testID}
        accessibilityLabel={accessibilityLabel || name}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole}
        {...rest}
      >
        <IconComponent
          name={name}
          size={iconSize}
          color={iconColor}
          style={[styles.icon, style]}
          suppressHighlighting
        />
      </View>
    );
  },
);

export default Icon;
