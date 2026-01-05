/**
 * Badge Component
 * Compact element for displaying status, count, or label
 */

import React, { forwardRef } from 'react';
import { View, TouchableOpacity } from 'react-native';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';
import { Text } from '../Text';

import { createBadgeStyles } from './Badge.styles';

import type { BadgeProps } from './Badge.types';

export const Badge = forwardRef<
  React.ElementRef<typeof View> | React.ElementRef<typeof TouchableOpacity>,
  BadgeProps
>(
  (
    {
      variant = 'default',
      size = 'md',
      label,
      leftIcon,
      rightIcon,
      dot = false,
      outlined = false,
      backgroundColor,
      color,
      borderColor,
      pressable = false,
      onPress,
      closable = false,
      onClose,
      style,
      textStyle,
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

    // Create styles
    const styles = createBadgeStyles(
      theme,
      variant,
      size,
      outlined,
      dot,
      backgroundColor,
      color,
      borderColor,
    );

    // Render badge content
    const renderContent = () => {
      // Dot badge has no content
      if (dot) return null;

      return (
        <>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

          {label !== undefined && <Text style={[styles.text, textStyle]}>{label}</Text>}

          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}

          {closable && onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel='Remove badge'
              accessibilityRole='button'
            >
              <Icon
                name='close'
                size={size === 'xs' ? 10 : size === 'sm' ? 12 : 14}
                color={color || theme.colors.onPrimary}
              />
            </TouchableOpacity>
          )}
        </>
      );
    };

    // If pressable, wrap in TouchableOpacity
    if (pressable && onPress) {
      return (
        <TouchableOpacity
          ref={ref as React.RefObject<React.ElementRef<typeof TouchableOpacity>>}
          style={[styles.container, style]}
          onPress={onPress}
          activeOpacity={0.7}
          testID={testID}
          accessibilityLabel={
            accessibilityLabel || (typeof label === 'string' ? label : String(label))
          }
          accessibilityHint={accessibilityHint}
          accessibilityRole={accessibilityRole || 'button'}
          {...rest}
        >
          {renderContent()}
        </TouchableOpacity>
      );
    }

    // Regular non-pressable badge
    return (
      <View
        ref={ref as React.RefObject<React.ElementRef<typeof View>>}
        style={[styles.container, style]}
        testID={testID}
        accessibilityLabel={
          accessibilityLabel || (typeof label === 'string' ? label : String(label))
        }
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole || 'text'}
        {...rest}
      >
        {renderContent()}
      </View>
    );
  },
);

Badge.displayName = 'Badge';

export default Badge;
