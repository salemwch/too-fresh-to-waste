/**
 * AnimatedCounter
 * Rolls a number from 0 → target over ~1 s using Easing.out(cubic).
 */

import React, { memo, useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/design-system/components/atoms';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
  /** Text variant forwarded to the design-system Text */
  variant?: 'headline' | 'title' | 'body';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  color?: string;
}

const AnimatedCounterComponent: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  style,
  prefix = '',
  suffix = '',
  variant = 'headline',
  size = 'lg',
  weight = 'bold',
  color,
}) => {
  const [animValue] = useState(() => new Animated.Value(0));
  const [displayValue, setDisplayValue] = useState(0);
  const colorStyle = color != null ? { color } : undefined;

  useEffect(() => {
    animValue.setValue(0);

    const listener = animValue.addListener(({ value: v }) => {
      setDisplayValue(Math.round(v));
    });

    Animated.timing(animValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // Cannot use native driver for value listeners
    }).start();

    return () => {
      animValue.removeListener(listener);
    };
  }, [value, duration, animValue]);

  return (
    <Text variant={variant} size={size} weight={weight} style={[colorStyle, style]}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </Text>
  );
};

export const AnimatedCounter = memo(AnimatedCounterComponent);
AnimatedCounterComponent.displayName = 'AnimatedCounter';
