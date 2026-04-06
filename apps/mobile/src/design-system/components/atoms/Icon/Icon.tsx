/**
 * Icon Component
 * Flexible icon component using react-native-vector-icons
 */

import AntDesignIcon from '@react-native-vector-icons/ant-design';
import EntypoIcon from '@react-native-vector-icons/entypo';
import EvilIconsIcon from '@react-native-vector-icons/evil-icons';
import FeatherIcon from '@react-native-vector-icons/feather';
import FontAwesomeIcon from '@react-native-vector-icons/fontawesome';
import FontAwesome5Icon from '@react-native-vector-icons/fontawesome5';
import FontAwesome6Icon from '@react-native-vector-icons/fontawesome6';
import FontistoIcon from '@react-native-vector-icons/fontisto';
import FoundationIcon from '@react-native-vector-icons/foundation';
import IoniconsIcon from '@react-native-vector-icons/ionicons';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import MaterialIconsIcon from '@react-native-vector-icons/material-icons';
import OcticonsIcon from '@react-native-vector-icons/octicons';
import SimpleLineIconsIcon from '@react-native-vector-icons/simple-line-icons';
import ZocialIcon from '@react-native-vector-icons/zocial';
import React, { forwardRef } from 'react';
import { View } from 'react-native';

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
      variant: _variant = 'default',
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
    const iconColor = color ?? colors.onSurface;

    /**
     * Get appropriate icon component based on family
     * Uses shared IconComponent type for type safety
     */
    const getIconComponent = (): IconComponent => {
      switch (family) {
        case 'AntDesign':
          return AntDesignIcon as IconComponent;
        case 'Entypo':
          return EntypoIcon as IconComponent;
        case 'EvilIcons':
          return EvilIconsIcon as IconComponent;
        case 'Feather':
          return FeatherIcon as IconComponent;
        case 'FontAwesome':
          return FontAwesomeIcon as IconComponent;
        case 'FontAwesome5':
          return FontAwesome5Icon as IconComponent;
        case 'FontAwesome6':
          return FontAwesome6Icon as IconComponent;
        case 'Fontisto':
          return FontistoIcon as IconComponent;
        case 'Foundation':
          return FoundationIcon as IconComponent;
        case 'MaterialCommunityIcons':
          return MaterialCommunityIcons as IconComponent;
        case 'MaterialIcons':
          return MaterialIconsIcon as IconComponent;
        case 'Octicons':
          return OcticonsIcon as IconComponent;
        case 'SimpleLineIcons':
          return SimpleLineIconsIcon as IconComponent;
        case 'Zocial':
          return ZocialIcon as IconComponent;
        case 'Ionicons':
        default:
          return IoniconsIcon as IconComponent;
      }
    };

    const IconComponent = getIconComponent();

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
