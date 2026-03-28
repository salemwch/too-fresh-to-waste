/**
 * MorphingButton — Liquid-fill login button
 *
 * Idle:    [      Sign In      ]           ← label visible
 * Loading: [  ▓▓▓ Logging in… ]           ← liquid rises + wave rotates
 * Success: [  ████ ✓ ████████ ]           ← green fill + check icon
 * Error:   [      Sign In      ]           ← resets to idle
 *
 * Props interface is unchanged — LoginScreen needs zero edits.
 * Animation logic ported from scale.md.
 */

import React, { useEffect, useCallback } from 'react';
import { StyleSheet, TouchableWithoutFeedback, View, Platform } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { useTheme } from '../../../providers';

// ─── constants ────────────────────────────────────────────────────────────────
const BUTTON_HEIGHT = 56;

// ─── CheckIcon ────────────────────────────────────────────────────────────────
const CheckIcon = ({ show }: { show: { value: number } }) => {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(show.value ? 1 : 0, { duration: 200 }),
    transform: [{ scale: withSpring(show.value ? 1 : 0) }],
  }));

  return (
    <Animated.View style={[styles.iconContainer, style]}>
      <Svg
        width={28}
        height={28}
        viewBox='0 0 24 24'
        fill='none'
        stroke='white'
        strokeWidth={4}
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <Path d='M20 6L9 17l-5-5' />
      </Svg>
    </Animated.View>
  );
};

// ─── props (unchanged) ───────────────────────────────────────────────────────
interface MorphingButtonProps {
  /** Text displayed in idle state */
  label: string;
  /** Text displayed after success animation (used for accessibility) */
  successLabel: string;
  /** Controlled loading flag — triggers liquid fill */
  loading: boolean;
  /** Controlled success flag — green fill + checkmark */
  success: boolean;
  /** Called on press; only fires when idle */
  onPress: () => void;
  /** Prevents press when true */
  disabled?: boolean;
  /** Style applied to the outer container */
  style?: StyleProp<ViewStyle>;
  /** Test ID for the pressable */
  testID?: string;
}

// ─── component ────────────────────────────────────────────────────────────────
export const MorphingButton: React.FC<MorphingButtonProps> = ({
  label,
  successLabel,
  loading,
  success,
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const theme = useTheme();

  // shared values
  const loadingVal = useSharedValue(0);
  const fillProgress = useSharedValue(0);
  const waveRotate = useSharedValue(0);
  const successState = useSharedValue(0);
  const scaleButton = useSharedValue(1);

  // ─── idle → loading ─────────────────────────────────────────────────────
  useEffect(() => {
    if (loading && !success) {
      loadingVal.value = 1;
      successState.value = 0;

      // press-scale feedback
      scaleButton.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 }),
      );

      // infinite wave rotation
      waveRotate.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false,
      );

      // liquid rises
      fillProgress.value = withTiming(0.9, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [loading, success, loadingVal, fillProgress, waveRotate, successState, scaleButton]);

  // ─── loading → success ──────────────────────────────────────────────────
  useEffect(() => {
    if (success) {
      fillProgress.value = withTiming(1.5, { duration: 300 });
      successState.value = 1;
      loadingVal.value = 0;
      cancelAnimation(waveRotate);
      waveRotate.value = 0;
    }
  }, [success, fillProgress, successState, loadingVal, waveRotate]);

  // ─── reset to idle (error path or remount) ─────────────────────────────
  useEffect(() => {
    if (!loading && !success) {
      loadingVal.value = 0;
      successState.value = 0;
      fillProgress.value = withTiming(0, { duration: 300 });
      cancelAnimation(waveRotate);
      waveRotate.value = 0;
    }
  }, [loading, success, loadingVal, successState, fillProgress, waveRotate]);

  // ─── animated styles ────────────────────────────────────────────────────
  const liquidStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      fillProgress.value,
      [0, 1],
      [BUTTON_HEIGHT * 2, -BUTTON_HEIGHT * 0.5],
    );

    return {
      transform: [{ translateY }, { rotate: `${waveRotate.value}deg` }],
      backgroundColor: successState.value === 1 ? '#10B981' : theme.colors.primary,
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loadingVal.value === 0 && successState.value === 0 ? 1 : 0, {
      duration: 200,
    }),
    transform: [
      {
        translateY: withTiming(loadingVal.value === 0 && successState.value === 0 ? 0 : -16),
      },
    ],
  }));

  const loadingLabelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loadingVal.value === 1 && successState.value === 0 ? 1 : 0, {
      duration: 200,
    }),
    transform: [
      {
        translateY: withTiming(loadingVal.value === 1 && successState.value === 0 ? 0 : 16),
      },
    ],
  }));

  const buttonContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleButton.value }],
    borderColor: successState.value === 1 ? '#005250' : theme.colors.primary,
  }));

  // ─── press handler ──────────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    if (disabled || loading || success) return;

    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        ReactNativeHapticFeedback.trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
    } catch {
      // haptic failure is non-fatal
    }

    onPress();
  }, [disabled, loading, success, onPress]);

  // ─── render ─────────────────────────────────────────────────────────────
  return (
    <View style={style}>
      <TouchableWithoutFeedback
        onPress={handlePress}
        testID={testID}
        accessibilityRole='button'
        accessibilityLabel={loading ? `${label}, loading` : success ? successLabel : label}
        accessibilityState={{
          disabled: disabled || loading || success,
          busy: loading,
        }}
      >
        <Animated.View style={[styles.button, { backgroundColor: theme.colors.primary }, buttonContainerStyle]}>
          {/* liquid fill layer — sits behind everything */}
          <Animated.View style={[styles.liquid, liquidStyle]} />

          {/* idle label */}
          <Animated.Text style={[styles.labelText, labelStyle]}>{label}</Animated.Text>

          {/* loading label */}
          <Animated.Text style={[styles.loadingLabel, loadingLabelStyle]}>
            Logging in…
          </Animated.Text>

          {/* success check icon */}
          <View style={styles.iconWrapper}>
            <CheckIcon show={successState} />
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  button: {
    height: BUTTON_HEIGHT,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  liquid: {
    position: 'absolute',
    left: -60,
    right: -60,
    height: BUTTON_HEIGHT * 3,
    borderRadius: BUTTON_HEIGHT * 1.5,
  },
  labelText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    lineHeight: BUTTON_HEIGHT,
    textAlign: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    lineHeight: BUTTON_HEIGHT,
    textAlign: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  iconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
