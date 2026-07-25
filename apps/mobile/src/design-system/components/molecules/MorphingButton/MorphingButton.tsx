/**
 * MorphingButton - Liquid-fill login button.
 *
 * Props interface is unchanged so existing callers need no edits.
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { trigger as triggerHapticFeedback } from 'react-native-haptic-feedback';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import IoniconsIcon from '@react-native-vector-icons/ionicons';

import { useTheme } from '../../../providers';

import type { StyleProp, ViewStyle } from 'react-native';

const BUTTON_HEIGHT = 56;

const CheckIcon = ({ show }: { show: { value: number } }) => {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(show.value ? 1 : 0, { duration: 200 }),
    transform: [{ scale: withSpring(show.value ? 1 : 0) }],
  }));

  return (
    <Animated.View style={[styles.iconContainer, style]}>
      <IoniconsIcon name='checkmark' size={28} color='white' />
    </Animated.View>
  );
};

interface MorphingButtonProps {
  label: string;
  successLabel: string;
  loading: boolean;
  success: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

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
  const { t } = useTranslation();
  const theme = useTheme();

  const loadingVal = useSharedValue(0);
  const fillProgress = useSharedValue(0);
  const waveRotate = useSharedValue(0);
  const successState = useSharedValue(0);
  const scaleButton = useSharedValue(1);

  useDerivedValue(() => {
    if (loading && !success) {
      loadingVal.value = 1;
      successState.value = 0;
      scaleButton.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 }),
      );
      waveRotate.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false,
      );
      fillProgress.value = withTiming(0.9, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      });
      return;
    }

    if (success) {
      fillProgress.value = withTiming(1.5, { duration: 300 });
      successState.value = 1;
      loadingVal.value = 0;
      cancelAnimation(waveRotate);
      waveRotate.value = 0;
      return;
    }

    loadingVal.value = 0;
    successState.value = 0;
    fillProgress.value = withTiming(0, { duration: 300 });
    cancelAnimation(waveRotate);
    waveRotate.value = 0;
  }, [loading, success]);

  const liquidStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      fillProgress.value,
      [0, 1],
      [BUTTON_HEIGHT * 2, -BUTTON_HEIGHT * 0.5],
    );

    return {
      transform: [{ translateY }, { rotate: `${waveRotate.value}deg` }],
      backgroundColor: successState.value === 1 ? theme.colors.success : theme.colors.primary,
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
    borderColor: successState.value === 1 ? theme.colors.success : theme.colors.primary,
  }));

  const handlePress = useCallback(() => {
    if (disabled || loading || success) return;

    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        triggerHapticFeedback('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
    } catch {
      // Haptic feedback failure is non-fatal.
    }

    onPress();
  }, [disabled, loading, success, onPress]);

  return (
    <View style={style}>
      <TouchableWithoutFeedback
        onPress={handlePress}
        testID={testID}
        accessibilityRole='button'
        accessibilityLabel={loading ? `${label}, loading` : success ? successLabel : label}
        accessibilityHint={t('common.a11ySubmitForm')}
        accessibilityState={{
          disabled: disabled || loading || success,
          busy: loading,
        }}
      >
        <Animated.View
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.primary,
              shadowColor: theme.colors.onSurface,
            },
            buttonContainerStyle,
          ]}
        >
          <Animated.View style={[styles.liquid, liquidStyle]} />

          <Animated.Text style={[styles.labelText, { color: theme.colors.onPrimary }, labelStyle]}>
            {label}
          </Animated.Text>

          <Animated.Text
            style={[styles.loadingLabel, { color: theme.colors.onPrimary }, loadingLabelStyle]}
          >
            Logging in...
          </Animated.Text>

          <View style={styles.iconWrapper}>
            <CheckIcon show={successState} />
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    height: BUTTON_HEIGHT,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
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
