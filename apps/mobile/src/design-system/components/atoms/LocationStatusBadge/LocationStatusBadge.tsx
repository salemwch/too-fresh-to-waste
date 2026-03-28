/**
 * LocationStatusBadge Component
 *
 * Displays current location mode (GPS, Manual, or Off).
 */

import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';
import { Text } from '../Text';

import type { LocationStatusBadgeProps, LocationMode } from './LocationStatusBadge.types';

/**
 * Get icon name and label for location mode
 */
function getModeConfig(mode: LocationMode, locationName?: string): { icon: string; label: string } {
  switch (mode) {
    case 'gps':
      return { icon: 'navigate', label: 'Using GPS' };
    case 'manual':
      return { icon: 'pin', label: locationName || 'Manual location' };
    case 'off':
    default:
      return { icon: 'location-off-outline', label: 'Location off' };
  }
}

export const LocationStatusBadge: React.FC<LocationStatusBadgeProps> = ({
  mode,
  locationName,
  size = 'md',
  onPress,
  style,
  textStyle,
  testID,
  accessibilityHint,
}) => {
  const theme = useTheme();
  const { icon, label } = useMemo(() => getModeConfig(mode, locationName), [mode, locationName]);

  const containerStyle = useMemo(() => {
    const baseStyle = {
      backgroundColor: mode === 'off' ? theme.colors.surfaceVariant : theme.colors.primaryContainer,
      paddingHorizontal: size === 'sm' ? 8 : 12,
      paddingVertical: size === 'sm' ? 4 : 6,
    };
    return [styles.container, baseStyle, style];
  }, [mode, theme.colors, size, style]);

  const iconColor = mode === 'off' ? theme.colors.onSurfaceVariant : theme.colors.primary;
  const iconSize = size === 'sm' ? 14 : 16;

  const content = (
    <>
      <Icon name={icon} size={iconSize} color={iconColor} style={styles.icon} />
      <Text
        variant='label'
        size={size === 'sm' ? 'xs' : 'sm'}
        weight='medium'
        color={mode === 'off' ? 'secondary' : 'primary'}
        style={textStyle}
        numberOfLines={1}
      >
        {label}
      </Text>
      {onPress && (
        <Icon
          name='chevron-down'
          size={size === 'sm' ? 12 : 14}
          color={iconColor}
          style={styles.chevron}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={containerStyle}
        onPress={onPress}
        testID={testID}
        accessibilityRole='button'
        accessibilityLabel={`Location: ${label}`}
        accessibilityHint={accessibilityHint || 'Tap to change location settings'}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={containerStyle}
      testID={testID}
      accessibilityRole='text'
      accessibilityLabel={`Location: ${label}`}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    maxWidth: 200,
  },
  icon: {
    marginRight: 6,
  },
  chevron: {
    marginLeft: 4,
  },
});

LocationStatusBadge.displayName = 'LocationStatusBadge';

