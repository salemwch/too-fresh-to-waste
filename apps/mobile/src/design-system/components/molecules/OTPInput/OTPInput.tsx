/**
 * OTP Input Component
 * Six-digit verification code input with auto-focus and paste support
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { TextInput, StyleSheet, Keyboard, Platform, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

import { useTheme } from '@/design-system/providers';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error = false,
  disabled = false,
  autoFocus = false,
}) => {
  const theme = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);

  // Shake animation for error
  const shakeAnimation = useSharedValue(0);

  useEffect(() => {
    if (error) {
      shakeAnimation.value = withSequence(
        withSpring(-10, { damping: 5 }),
        withSpring(10, { damping: 5 }),
        withSpring(-10, { damping: 5 }),
        withSpring(10, { damping: 5 }),
        withSpring(0, { damping: 5 }),
      );
    }
  }, [error]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 300);
    }
  }, [autoFocus]);

  const handleChangeText = useCallback(
    (text: string, index: number) => {
      // Handle paste
      if (text.length > 1) {
        const pastedCode = text.slice(0, length);
        onChange(pastedCode);

        // Focus last input or blur if complete
        if (pastedCode.length === length) {
          Keyboard.dismiss();
        } else {
          const nextIndex = Math.min(pastedCode.length, length - 1);
          inputRefs.current[nextIndex]?.focus();
        }
        return;
      }

      // Single digit input
      const newValue = value.split('');
      newValue[index] = text;
      const newCode = newValue.join('');
      onChange(newCode);

      // Auto-focus next input
      if (text && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Dismiss keyboard when complete
      if (text && index === length - 1) {
        Keyboard.dismiss();
      }
    },
    [value, onChange, length],
  );

  const handleKeyPress = useCallback(
    (e: any, index: number) => {
      if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [value],
  );

  const handleFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedIndex(null);
  }, []);

  const handleBoxPress = useCallback(
    (index: number) => {
      if (!disabled) {
        inputRefs.current[index]?.focus();
      }
    },
    [disabled],
  );

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {Array.from({ length }).map((_, index) => {
        const isActive = focusedIndex === index;
        const isFilled = !!value[index];
        const borderColor = error
          ? theme.colors.error
          : isActive
            ? theme.colors.primary
            : isFilled
              ? theme.colors.primary
              : theme.colors.outline;

        return (
          <Pressable
            key={index}
            onPress={() => handleBoxPress(index)}
            style={[
              styles.inputContainer,
              {
                borderColor,
                borderWidth: isActive ? 2 : 1,
                backgroundColor: disabled
                  ? theme.colors.surfaceVariant
                  : isActive
                    ? theme.colors.primaryContainer
                    : theme.colors.surface,
              },
            ]}
          >
            <TextInput
              ref={ref => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.input,
                {
                  color: disabled ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                },
              ]}
              value={value[index] || ''}
              onChangeText={text => handleChangeText(text, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              keyboardType='number-pad'
              maxLength={1}
              selectTextOnFocus
              editable={!disabled}
              textContentType='oneTimeCode'
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            />
          </Pressable>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  inputContainer: {
    width: 48,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
});
