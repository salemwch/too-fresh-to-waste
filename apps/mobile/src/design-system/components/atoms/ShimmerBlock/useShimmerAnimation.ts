/**
 * Shared shimmer animation hook.
 * Eliminates duplicated Animated.loop setup across all skeleton components.
 *
 * Two variants:
 * - 'gradient' (default): 0→1 with instant reset — drives LinearGradient translateX.
 * - 'pulse': 0→1→0 smooth — drives opacity interpolation.
 *
 * @param variant - Animation variant
 * @param active  - Whether animation should run (modal skeletons pass `visible`)
 */

import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

export function useShimmerAnimation(
  variant: 'gradient' | 'pulse' = 'gradient',
  active = true,
): Animated.Value {
  const [animValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;

    const resetDuration = variant === 'gradient' ? 0 : 1500;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: resetDuration,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [animValue, variant, active]);

  return animValue;
}
