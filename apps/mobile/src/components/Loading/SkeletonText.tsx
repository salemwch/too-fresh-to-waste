/**
 * Skeleton Text Component
 * Text loading placeholder with multiple lines
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { SkeletonBase } from './SkeletonBase';

import type { DimensionValue } from 'react-native';

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: DimensionValue; // Using React Native's DimensionValue type
  spacing?: number;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lineHeight = 16,
  lastLineWidth = '60%',
  spacing = 8,
}) => (
  <View style={styles.container}>
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonBase
        key={index}
        width={index === lines - 1 ? lastLineWidth : '100%'}
        height={lineHeight}
        style={{ marginBottom: index < lines - 1 ? spacing : 0 }}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

/**
 * Usage:
 *
 * ```tsx
 * <SkeletonText lines={3} lineHeight={20} />
 * ```
 */
