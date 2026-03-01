/**
 * SurpriseBagCard Component
 * Displays surprise bag pricing, rating, and pickup time
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { Badge } from '@/design-system/components/atoms/Badge';
import { useTheme } from '@/design-system/providers';

interface SurpriseBagCardProps {
  /** Original price */
  originalPrice: number;
  /** Discounted price */
  discountedPrice: number;
  /** Establishment rating (0-5) */
  rating: number;
  /** Number of reviews */
  reviewCount: number;
  /** Pickup start time (HH:mm) */
  pickupStart: string;
  /** Pickup end time (HH:mm) */
  pickupEnd: string;
  /** Is pickup today */
  isToday?: boolean;
  /** Currency symbol */
  currency?: string;
  /** Test ID */
  testID?: string;
}

export const SurpriseBagCard: React.FC<SurpriseBagCardProps> = ({
  originalPrice,
  discountedPrice,
  rating,
  reviewCount,
  pickupStart,
  pickupEnd,
  isToday = true,
  currency = 'TND',
  testID = 'surprise-bag-card',
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]} testID={testID}>
      {/* Header with pricing - HORIZONTAL LAYOUT */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name='shopping-bag' size={20} color={theme.colors.onSurfaceVariant} />
          <Text variant='body' size='md' weight='medium'>
            Surprise Bag
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text variant='body' size='sm' color='secondary' style={styles.originalPrice}>
            {currency}
            {originalPrice.toFixed(2)}
          </Text>
          <Text variant='headline' size='xl' weight='bold' color='primary'>
            {currency}
            {discountedPrice.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Rating */}
      <View style={styles.ratingRow}>
        <Icon name='star' size={16} color='#FFA500' />
        <Text variant='body' size='md' weight='medium'>
          {rating.toFixed(1)}
        </Text>
        <Text variant='body' size='md' color='secondary'>
          ({reviewCount})
        </Text>
      </View>

      {/* Pickup Time */}
      <View style={styles.pickupRow}>
        <Icon name='clock' size={16} color={theme.colors.onSurfaceVariant} />
        <Text variant='body' size='md'>
          Pick up: {pickupStart} - {pickupEnd}
        </Text>
        {isToday && (
          <Badge variant='success' size='sm'>
            Today
          </Badge>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
