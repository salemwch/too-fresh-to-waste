/**
 * Skeleton Base Component
 * Animated skeleton for loading states
 *
 * Production Standards:
 * - Smooth shimmer animation
 * - Accessibility
 * - Customizable size/shape
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet } from 'react-native';

import { useTheme } from '@/design-system/providers';

import type { ViewStyle, DimensionValue } from 'react-native';

interface SkeletonBaseProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
  testID?: string;
}

export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  testID = 'skeleton',
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    // Shimmer animation
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceVariant,
        },
        { opacity },
        style,
      ]}
      testID={testID}
      accessibilityLabel={t('common.a11yLoading')}
      accessibilityHint={t('common.a11yLoadingHint')}
      accessibilityRole='progressbar'
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
