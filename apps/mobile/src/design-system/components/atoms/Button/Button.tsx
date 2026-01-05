/**
 * Button Component
 * Enterprise-grade button with platform-specific styling and animations
 */

import React, { useRef, forwardRef, useCallback } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, Animated, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';

import { createButtonStyles } from './Button.styles';

import type { ButtonProps } from './Button.types';
import type { IconFamily } from '../../../types';

export const Button = forwardRef<React.ComponentRef<typeof TouchableOpacity>, ButtonProps>(
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
      platform = 'auto',
      style,

      textStyle,
      hapticFeedback = true,
      animation = { scale: 0.95, duration: 150 },
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
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const isDisabled = disabled || loading;

    // Create styles based on current props and theme
    const styles = createButtonStyles(theme, variant, size, fullWidth, isDisabled);

    // Get icon size based on button size
    const getIconSize = () => {
      switch (size) {
        case 'xs':
          return 14;
        case 'sm':
          return 16;
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
      if (!icon) return null;

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
      (event: any) => {
        // Enterprise-grade haptic feedback with proper error handling and platform checks
        if (hapticFeedback && !isDisabled) {
          try {
            // Only trigger haptics on supported platforms
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              // Use impactLight for subtle, professional tactile feedback
              // Options: enableVibrateFallback ensures Android devices without haptic support still vibrate
              ReactNativeHapticFeedback.trigger('impactLight', {
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false, // Respect user's system settings
              });
            }
          } catch (error) {
            // Graceful degradation: log error but don't block UI interaction
            // In production, consider using a logging service (e.g., Sentry)
            if (__DEV__) {
              console.warn('Haptic feedback failed:', error);
            }
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
      (event: any) => {
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
      (event: any) => {
        if (!isDisabled) {
          onPress?.(event);
        }
      },
      [isDisabled, onPress],
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
              <Text style={[styles.text, { marginLeft: theme.spacing.sm }, textStyle]}>
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
        <TouchableOpacity
          ref={ref}
          style={[styles.container]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          activeOpacity={0.8}
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
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

Button.displayName = 'Button';

export default Button;
