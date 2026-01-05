/**
 * Skeleton List Component
 * List of skeleton items
 */

import React from 'react';
import { View } from 'react-native';

import { SkeletonCard } from './SkeletonCard';

interface SkeletonListProps {
  count?: number;
  hasImage?: boolean;
  hasAvatar?: boolean;
  testID?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 3,
  hasImage = true,
  hasAvatar = false,
  testID = 'skeleton-list',
}) => (
  <View testID={testID}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard
        key={index}
        hasImage={hasImage}
        hasAvatar={hasAvatar}
        testID={`${testID}-item-${index}`}
      />
    ))}
  </View>
);

/**
 * Usage:
 *
 * ```tsx
 * {isLoading ? (
 *   <SkeletonList count={5} hasImage hasAvatar />
 * ) : (
 *   <FlatList data={offers} renderItem={renderOffer} />
 * )}
 * ```
 */
