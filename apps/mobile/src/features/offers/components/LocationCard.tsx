/**
 * LocationCard Component
 * Displays establishment address with map navigation
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

interface LocationCardProps {
  /** Full address string */
  address: string;
  /** Subtitle text (e.g., "More information about the store") */
  subtitle?: string;
  /** On press callback (opens maps) */
  onPress?: () => void;
  /** Test ID */
  testID?: string;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  address,
  subtitle = 'More information about the store',
  onPress,
  testID = 'location-card',
}) => {
  const theme = useTheme();

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceVariant,
        },
      ]}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityLabel={`Location: ${address}`}
      accessibilityHint='Tap to open in maps'
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary }]}>
        <Icon name='map-pin' size={20} color='#fff' />
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <Text variant='body' size='md' weight='medium' numberOfLines={1}>
          {address}
        </Text>
        <Text variant='body' size='sm' color='secondary' numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {/* Arrow */}
      <Icon name='chevron-right' size={20} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});
