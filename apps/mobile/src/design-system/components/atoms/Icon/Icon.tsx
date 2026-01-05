/**
 * Icon Component
 * Flexible icon component using react-native-vector-icons
 */

import React, { forwardRef } from 'react';
import { View } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Entypo from 'react-native-vector-icons/Entypo';
import EvilIcons from 'react-native-vector-icons/EvilIcons';
import Feather from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import Fontisto from 'react-native-vector-icons/Fontisto';
import Foundation from 'react-native-vector-icons/Foundation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Octicons from 'react-native-vector-icons/Octicons';
import SimpleLineIcons from 'react-native-vector-icons/SimpleLineIcons';
import Zocial from 'react-native-vector-icons/Zocial';

import { useTheme } from '../../../providers';

import { createIconStyles, getIconSize } from './Icon.styles';

import type { IconProps } from './Icon.types';
import type { IconComponent } from '../../../types';

export const Icon = forwardRef<View, IconProps>(
  (
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

Icon.displayName = 'Icon';

export default Icon;
