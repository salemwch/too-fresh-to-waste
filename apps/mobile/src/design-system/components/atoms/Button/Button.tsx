/**
 * Button Component
 * Enterprise-grade button with platform-specific styling and animations
 */

import React, { useState, forwardRef, useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  Animated,
  Platform,
  type GestureResponderEvent,
} from 'react-native';
import { trigger as triggerHapticFeedback } from 'react-native-haptic-feedback';

import { usePressGuard } from '../../../../hooks/usePressGuard';
import { useTheme } from '../../../providers';
import { Icon } from '../Icon';

import { createButtonStyles } from './Button.styles';

import type { ButtonProps } from './Button.types';
import type { IconFamily } from '../../../types';

export const Button = forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      children,
      loading = false,
      disabled = false,
      leftIcon,
      leftIconFamily,
      rightIcon,
      rightIconFamily,
      fullWidth = false,
      platform: _platform = 'auto',
      style,

      textStyle,
      hapticFeedback = true,
      animation = { scale: 0.95, duration: 150 },
      pressGuardMs,
      onPress,
      onPressIn,
      onPressOut,
      testID,
      accessibilityLabel,
      accessibilityHint,
      accessibilityRole = 'button',
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme();
    const [scaleAnim] = useState(() => new Animated.Value(1));
    const isDisabled = Boolean(disabled) || loading;
    const { guardedPress } = usePressGuard(onPress ?? undefined, pressGuardMs ?? 0);

    // Create styles based on current props and theme
    const styles = createButtonStyles(theme, variant, size, fullWidth, isDisabled);

    // Get icon size based on button size
    const getIconSize = () => {
      switch (size) {
        case 'xs':
          return 14;
        case 'sm':
          return 16;
        case 'md':
          return 18;
        case 'lg':
        case 'xl':
          return 22;
        default:
          return 18;
      }
    };

    // Render icon - handles both ReactNode and string icon names
    const renderIcon = (
      icon: React.ReactNode | string | undefined,
      iconFamily: IconFamily | undefined,
    ): React.ReactNode => {
      if (icon == null || icon === false || icon === '') return null;

      // If icon is a string, render as Icon component
      if (typeof icon === 'string') {
        return (
          <Icon
            name={icon}
            family={iconFamily ?? 'Ionicons'}
            size={getIconSize()}
            color={styles.text.color as string}
          />
        );
      }

      // Otherwise render as-is (ReactNode)
      return icon;
    };

    // Handle press in with animation and haptics
    const handlePressIn = useCallback(
      (event: GestureResponderEvent) => {
        // Enterprise-grade haptic feedback with proper error handling and platform checks
        if (hapticFeedback && !isDisabled) {
          try {
            // Only trigger haptics on supported platforms
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              // Use impactLight for subtle, professional tactile feedback
              // Options: enableVibrateFallback ensures Android devices without haptic support still vibrate
              triggerHapticFeedback('impactLight', {
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false, // Respect user's system settings
              });
            }
          } catch {
            // Graceful degradation: haptic failure is non-fatal, interaction continues
          }
        }

        // Scale animation with native driver for optimal performance
        Animated.timing(scaleAnim, {
          toValue: animation.scale ?? 0.95,
          duration: animation.duration ?? 150,
          useNativeDriver: true, // Critical for 60fps animations
        }).start();

        onPressIn?.(event);
      },
      [animation, hapticFeedback, isDisabled, onPressIn, scaleAnim],
    );

    // Handle press out with animation
    const handlePressOut = useCallback(
      (event: GestureResponderEvent) => {
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: animation.duration ?? 150,
          useNativeDriver: true,
        }).start();

        onPressOut?.(event);
      },
      [animation.duration, onPressOut, scaleAnim],
    );

    // Handle press with proper disabled state check
    const handlePress = useCallback(
      (event: GestureResponderEvent) => {
        if (!isDisabled) {
          guardedPress(event);
        }
      },
      [guardedPress, isDisabled],
    );

    // Render button content
    const renderContent = () => {
      const leftIconElement = renderIcon(leftIcon, leftIconFamily);
      const rightIconElement = renderIcon(rightIcon, rightIconFamily);

      if (loading) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size={size === 'xs' || size === 'sm' ? 'small' : 'large'}
              color={styles.text.color}
            />
            {children != null && (
              <Text style={[styles.text, { marginStart: theme.spacing.sm }, textStyle]}>
                {typeof children === 'string' ? children : children}
              </Text>
            )}
          </View>
        );
      }

      return (
        <View style={styles.loadingContainer}>
          {leftIconElement != null && <View style={styles.leftIcon}>{leftIconElement}</View>}
          {children != null && <Text style={[styles.text, textStyle]}>{children}</Text>}
          {rightIconElement != null && <View style={styles.rightIcon}>{rightIconElement}</View>}
        </View>
      );
    };

    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <Pressable
          ref={ref}
          style={[styles.container]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          testID={testID}
          accessibilityLabel={
            accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
          }
          accessibilityHint={accessibilityHint}
          accessibilityRole={accessibilityRole}
          accessibilityState={{
            disabled: isDisabled,
            busy: loading,
          }}
          {...rest}
        >
          {renderContent()}
        </Pressable>
      </Animated.View>
    );
  },
);

Button.displayName = 'Button';
