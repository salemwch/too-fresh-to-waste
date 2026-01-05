/**
 * Card Component
 * Flexible container component with elevation and various styling options
 */

import React, { forwardRef, useRef } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';

import { useTheme } from '../../../providers';

import { createCardStyles } from './Card.styles';

import type { CardProps } from './Card.types';

export const Card = forwardRef<
  React.ElementRef<typeof View> | React.ElementRef<typeof TouchableOpacity>,
  CardProps
>(
  (
    {
      variant = 'default',
      size = 'md',
      pressable = false,
      onPress,
      loading = false,
      disabled = false,
      style,
      children,
      platform = 'auto',
      animation = { scale: 0.98, duration: 150 },
      testID,
      accessibilityLabel,
      accessibilityHint,
      accessibilityRole,
      onBlur: _onBlur,
      onFocus: _onFocus,
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Create styles based on current props and theme
    const styles = createCardStyles(theme, variant, size, disabled);

    // Handle press animations
    const handlePressIn = () => {
      if (pressable && !disabled) {
        Animated.timing(scaleAnim, {
          toValue: animation.scale ?? 0.98,
          duration: animation.duration ?? 150,
          useNativeDriver: true,
        }).start();
      }
    };

    const handlePressOut = () => {
      if (pressable && !disabled) {
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: animation.duration ?? 150,
          useNativeDriver: true,
        }).start();
      }
    };

    const handlePress = () => {
      if (!disabled && onPress) {
        onPress();
      }
    };

    // Render loading overlay
    const renderLoadingOverlay = () => {
      if (!loading) return null;

      return (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size='large' color={theme.colors.primary} />
        </View>
      );
    };

    // Render card content
    const renderContent = () => (
      <>
        {children}
        {renderLoadingOverlay()}
      </>
    );

    // If pressable, wrap in TouchableOpacity with animation
    if (pressable) {
      return (
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
          <TouchableOpacity
            ref={ref as React.RefObject<React.ElementRef<typeof TouchableOpacity>>}
            style={styles.pressable}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            activeOpacity={0.95}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityRole={accessibilityRole || 'button'}
            accessibilityState={{
              disabled: disabled || loading,
              busy: loading,
            }}
            {...rest}
          >
            {renderContent()}
          </TouchableOpacity>
        </Animated.View>
      );
    }

    // Regular non-pressable card
    return (
      <View
        ref={ref as React.RefObject<React.ElementRef<typeof View>>}
        style={[styles.container, style]}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole}
        {...rest}
      >
        {renderContent()}
      </View>
    );
  },
);

Card.displayName = 'Card';

export default Card;
