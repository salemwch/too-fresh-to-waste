/**
 * Skeleton Card Component
 * Card loading placeholder
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Card } from '@/design-system/components/atoms';

import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

interface SkeletonCardProps {
  hasImage?: boolean;
  imageHeight?: number;
  hasAvatar?: boolean;
  testID?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  hasImage = true,
  imageHeight = 150,
  hasAvatar = false,
  testID = 'skeleton-card',
}) => (
  <Card style={styles.card} testID={testID}>
    {/* Image placeholder */}
    {hasImage && (
      <SkeletonBase width='100%' height={imageHeight} borderRadius={8} style={styles.image} />
    )}

    {/* Header with avatar */}
    {hasAvatar && (
      <View style={styles.header}>
        <SkeletonBase width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <SkeletonBase width='60%' height={16} />
          <SkeletonBase width='40%' height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
    )}

    {/* Content */}
    <View style={styles.content}>
      <SkeletonText lines={3} lineHeight={16} />
    </View>

    {/* Footer */}
    <View style={styles.footer}>
      <SkeletonBase width={80} height={32} borderRadius={16} />
      <SkeletonBase width={60} height={20} />
    </View>
  </Card>
);

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  content: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

/**
 * Usage:
 *
 * ```tsx
 * {isLoading && (
 *   <>
 *     <SkeletonCard />
 *     <SkeletonCard hasAvatar />
 *     <SkeletonCard hasImage={false} />
 *   </>
 * )}
 * ```
 */
