/**
 * NearbyOffersEmptyState Component
 *
 * Friendly empty state shown when no offers are found nearby.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '../../../providers';
import { Text, Button, Icon } from '../../atoms';

import type { NearbyOffersEmptyStateProps } from './NearbyOffersEmptyState.types';

export const NearbyOffersEmptyState: React.FC<NearbyOffersEmptyStateProps> = ({
  radiusKm,
  onExpandRadius,
  onBrowseAll,
  style,
  testID,
}) => {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityRole='alert'
      accessibilityLabel={`No offers found within ${radiusKm} kilometers`}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceVariant }]}
        accessibilityElementsHidden
      >
        <Icon
          name='location-outline'
          family='Ionicons'
          size={48}
          color={theme.colors.onSurfaceVariant}
        />
      </View>

      <Text variant='title' size='lg' weight='semibold' align='center' style={styles.title}>
        No offers nearby
      </Text>

      <Text variant='body' size='md' color='secondary' align='center' style={styles.description}>
        We couldn&apos;t find any offers within {radiusKm} km of your location. Try expanding your
        search area or browse all available offers.
      </Text>

      <View style={styles.buttonContainer}>
        {onExpandRadius && (
          <Button
            variant='outline'
            size='md'
            onPress={onExpandRadius}
            style={styles.button}
            accessibilityLabel='Expand search radius'
            accessibilityHint='Doubles your current search radius to find more offers'
          >
            Expand radius
          </Button>
        )}

        {onBrowseAll && (
          <Button
            variant='primary'
            size='md'
            onPress={onBrowseAll}
            style={styles.button}
            accessibilityLabel='Browse all offers'
            accessibilityHint='View all available offers without location filter'
          >
            Browse all offers
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  button: {
    minWidth: 140,
  },
});

NearbyOffersEmptyState.displayName = 'NearbyOffersEmptyState';
