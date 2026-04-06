/**
 * Badge Component
 * Compact element for displaying status, count, or label
 */

import React, { forwardRef } from 'react';
import { View, Pressable } from 'react-native';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';
import { Text } from '../Text';

import { createBadgeStyles } from './Badge.styles';

import type { BadgeProps } from './Badge.types';

const hasRenderableNode = (
  value: React.ReactNode | undefined,
): value is Exclude<React.ReactNode, null | undefined | false> =>
  value !== null && value !== undefined && value !== false;

export const Badge = forwardRef<
  React.ElementRef<typeof View> | React.ElementRef<typeof Pressable>,
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
          {hasRenderableNode(leftIcon) && <View style={styles.leftIcon}>{leftIcon}</View>}

          {label !== undefined && <Text style={[styles.text, textStyle]}>{label}</Text>}

          {hasRenderableNode(rightIcon) && <View style={styles.rightIcon}>{rightIcon}</View>}

          {closable && onClose !== undefined && (
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel='Remove badge'
              accessibilityRole='button'
            >
              <Icon
                name='close'
                size={size === 'xs' ? 10 : size === 'sm' ? 12 : 14}
                color={color ?? theme.colors.onPrimary}
              />
            </Pressable>
          )}
        </>
      );
    };

    // If pressable, wrap in Pressable
    if (pressable && onPress !== undefined) {
      return (
        <Pressable
          ref={ref as React.RefObject<React.ElementRef<typeof Pressable>>}
          style={[styles.container, style]}
          onPress={onPress}
          testID={testID}
          accessibilityLabel={
            accessibilityLabel ?? (label !== undefined ? String(label) : undefined)
          }
          accessibilityHint={accessibilityHint}
          accessibilityRole={accessibilityRole ?? 'button'}
          {...rest}
        >
          {renderContent()}
        </Pressable>
      );
    }

    // Regular non-pressable badge
    return (
      <View
        ref={ref as React.RefObject<React.ElementRef<typeof View>>}
        style={[styles.container, style]}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? (label !== undefined ? String(label) : undefined)}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole ?? 'text'}
        {...rest}
      >
        {renderContent()}
      </View>
    );
  },
);

Badge.displayName = 'Badge';
