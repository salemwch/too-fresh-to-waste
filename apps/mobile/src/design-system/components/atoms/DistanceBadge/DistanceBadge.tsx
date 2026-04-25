/**
 * DistanceBadge Component
 *
 * Displays distance in a compact, human-readable format.
 * Automatically formats meters to km when appropriate.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';
import { Text } from '../Text';

import type { DistanceBadgeProps } from './DistanceBadge.types';

/**
 * Format distance in meters to human-readable string
 * - < 1000m: show in meters (e.g., "350 m")
 * - >= 1000m: show in km with 1 decimal (e.g., "1.2 km")
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

export const DistanceBadge: React.FC<DistanceBadgeProps> = ({
  distance,
  variant = 'default',
  showIcon = true,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}) => {
  const theme = useTheme();

  const formattedDistance = useMemo(() => formatDistance(distance), [distance]);

  const containerStyle = useMemo(() => {
    const baseStyle = {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: variant === 'pill' ? 16 : 4,
      paddingHorizontal: variant === 'compact' ? 6 : 8,
      paddingVertical: variant === 'compact' ? 2 : 4,
    };
    return [styles.container, baseStyle, style];
  }, [theme.colors.surfaceVariant, variant, style]);

  return (
    <View
      style={containerStyle}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? `${formattedDistance} away`}
      accessibilityHint='Shows the distance to this location'
      accessibilityRole='text'
    >
      {showIcon && (
        <Icon
          name='location-outline'
          size={variant === 'compact' ? 12 : 14}
          color={theme.colors.primary}
          style={styles.icon}
        />
      )}
      <Text
        variant='label'
        size={variant === 'compact' ? 'xs' : 'sm'}
        weight='medium'
        color='secondary'
        style={textStyle}
      >
        {formattedDistance}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 4,
  },
});

DistanceBadge.displayName = 'DistanceBadge';
