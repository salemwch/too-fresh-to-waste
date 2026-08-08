/**
 * EnteringView — mount-entrance animation primitive.
 *
 * Replaces react-native-reanimated's declarative `entering={FadeInUp.delay(100)}`
 * prop, which has no equivalent in React Native's own Animated API. Reanimated
 * cost 2.09 MB of native code (libreanimated.so + libworklets.so) for five call
 * sites, none of which needed the UI-thread worklet runtime: every property
 * animated here is opacity/transform, so plain Animated drives them natively too.
 *
 * The values below mirror Reanimated's defaults exactly, so the motion is
 * unchanged (react-native-reanimated/lib/module/layoutReanimation/
 * defaultAnimations/{Fade,Zoom}.js):
 *
 *   fadeIn     opacity 0 → 1
 *   fadeInUp   opacity 0 → 1, translateY -25 → 0   (drops in from above)
 *   fadeInDown opacity 0 → 1, translateY  25 → 0   (rises in from below)
 *   zoomIn     scale   0 → 1                       (no opacity — matches ZoomIn)
 *
 * Runs once on mount and is not reversible; there is no `exiting` counterpart,
 * because nothing in the app used one.
 *
 * @example
 * // was: <Animated.View entering={FadeInUp.delay(100)} style={styles.header}>
 * <EnteringView animation='fadeInUp' delay={100} style={styles.header}>
 */

import React, { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import type { StyleProp, ViewStyle } from 'react-native';

type EnteringAnimation = 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'zoomIn';

/** Reanimated's default layout-animation duration. */
const DEFAULT_DURATION = 300;
/** Reanimated's Fade*Up/Down offset, in dp. */
const TRANSLATE_OFFSET = 25;

interface EnteringViewProps {
  children?: React.ReactNode;
  animation?: EnteringAnimation;
  /** Milliseconds to wait before starting. Mirrors `.delay(ms)`. */
  delay?: number;
  /** Milliseconds the animation runs for. Mirrors `.duration(ms)`. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const EnteringView: React.FC<EnteringViewProps> = ({
  children,
  animation = 'fadeIn',
  delay = 0,
  duration = DEFAULT_DURATION,
  style,
  testID,
}) => {
  // useState initialiser (not useRef) matches useShimmerAnimation's pattern and
  // guarantees the Animated.Value is constructed exactly once.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const timing = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });

    timing.start();
    // Stop on unmount so a delayed animation cannot fire against a torn-down view.
    return () => timing.stop();
  }, [progress, duration, delay]);

  // Built inline rather than memoised: interpolate() returns a new node either
  // way, and these views mount once and are never re-rendered by this component.
  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> =
    animation === 'zoomIn'
      ? { transform: [{ scale: progress }] }
      : animation === 'fadeIn'
        ? { opacity: progress }
        : {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [animation === 'fadeInUp' ? -TRANSLATE_OFFSET : TRANSLATE_OFFSET, 0],
                }),
              },
            ],
          };

  return (
    <Animated.View style={[style, animatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
};
