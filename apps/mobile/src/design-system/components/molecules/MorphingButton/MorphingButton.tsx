/**
 * MorphingButton - Liquid-fill login button.
 *
 * Props interface is unchanged so existing callers need no edits.
 *
 * Migrated off react-native-reanimated to React Native's own Animated. Every
 * property animated here is opacity/transform, so all of it still runs on the
 * native driver — the worklet runtime bought nothing. The two colour props
 * (`backgroundColor`/`borderColor`) were discrete `successState === 1` ternaries
 * rather than animations, so they are now plain style values derived from the
 * `success` prop; that also keeps them off the non-native-driver path.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { trigger as triggerHapticFeedback } from 'react-native-haptic-feedback';
import IoniconsIcon from '@react-native-vector-icons/ionicons';

import { useTheme } from '../../../providers';

import type { StyleProp, ViewStyle } from 'react-native';

const BUTTON_HEIGHT = 56;
/** react-native-reanimated's withTiming default, preserved so timings match. */
const DEFAULT_EASING = Easing.inOut(Easing.quad);

const CheckIcon = ({ progress }: { progress: Animated.Value }) => (
  <Animated.View
    style={[
      styles.iconContainer,
      {
        // Spring overshoots past 1 to give the pop; clamp opacity so it cannot
        // exceed 1 while scale keeps the bounce.
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        }),
        transform: [{ scale: progress }],
      },
    ]}
  >
    <IoniconsIcon name='checkmark' size={28} color='white' />
  </Animated.View>
);

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

  const [labelVisible] = useState(() => new Animated.Value(1));
  const [loadingVisible] = useState(() => new Animated.Value(0));
  const [checkVisible] = useState(() => new Animated.Value(0));
  const [fillProgress] = useState(() => new Animated.Value(0));
  const [waveRotate] = useState(() => new Animated.Value(0));
  const [scaleButton] = useState(() => new Animated.Value(1));

  const isLoading = loading && !success;

  // Cross-fades, fill level and the press bounce. Grouped in one parallel batch
  // so they stay in step the way the single reanimated worklet did.
  useEffect(() => {
    const fade = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, {
        toValue,
        duration: 200,
        easing: DEFAULT_EASING,
        useNativeDriver: true,
      });

    const animations: Animated.CompositeAnimation[] = [
      fade(labelVisible, !loading && !success ? 1 : 0),
      fade(loadingVisible, isLoading ? 1 : 0),
      Animated.spring(checkVisible, {
        toValue: success ? 1 : 0,
        useNativeDriver: true,
      }),
      Animated.timing(fillProgress, {
        toValue: isLoading ? 0.9 : success ? 1.5 : 0,
        duration: isLoading ? 2000 : 300,
        easing: isLoading ? Easing.inOut(Easing.ease) : DEFAULT_EASING,
        useNativeDriver: true,
      }),
    ];

    if (isLoading) {
      animations.push(
        Animated.sequence([
          Animated.timing(scaleButton, {
            toValue: 0.95,
            duration: 100,
            easing: DEFAULT_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(scaleButton, {
            toValue: 1,
            duration: 100,
            easing: DEFAULT_EASING,
            useNativeDriver: true,
          }),
        ]),
      );
    }

    const batch = Animated.parallel(animations);
    batch.start();
    return () => batch.stop();
  }, [
    loading,
    success,
    isLoading,
    labelVisible,
    loadingVisible,
    checkVisible,
    fillProgress,
    scaleButton,
  ]);

  // The wave only spins while loading. Kept separate because it is a loop with
  // its own lifetime — reanimated did the same via cancelAnimation().
  useEffect(() => {
    if (!isLoading) {
      waveRotate.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(waveRotate, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => {
      loop.stop();
      waveRotate.setValue(0);
    };
  }, [isLoading, waveRotate]);

  const liquidStyle = {
    transform: [
      {
        translateY: fillProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [BUTTON_HEIGHT * 2, -BUTTON_HEIGHT * 0.5],
        }),
      },
      {
        rotate: waveRotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const labelStyle = {
    opacity: labelVisible,
    transform: [
      { translateY: labelVisible.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
    ],
  };

  const loadingLabelStyle = {
    opacity: loadingVisible,
    transform: [
      { translateY: loadingVisible.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  };

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

  const accentColor = success ? theme.colors.success : theme.colors.primary;

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
              borderColor: accentColor,
              transform: [{ scale: scaleButton }],
            },
          ]}
        >
          <Animated.View style={[styles.liquid, { backgroundColor: accentColor }, liquidStyle]} />

          <Animated.Text style={[styles.labelText, { color: theme.colors.onPrimary }, labelStyle]}>
            {label}
          </Animated.Text>

          <Animated.Text
            style={[styles.loadingLabel, { color: theme.colors.onPrimary }, loadingLabelStyle]}
          >
            Logging in...
          </Animated.Text>

          <View style={styles.iconWrapper}>
            <CheckIcon progress={checkVisible} />
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
