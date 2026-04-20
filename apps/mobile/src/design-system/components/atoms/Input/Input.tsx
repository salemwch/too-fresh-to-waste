/**
 * Input Component
 * Text input with label, helper text, and validation styling
 */

import IoniconsIcon from '@react-native-vector-icons/ionicons';
import MaterialCommunityIconsIcon from '@react-native-vector-icons/material-design-icons';
import React, { forwardRef, useState, useCallback } from 'react';
import { View, TextInput, Pressable } from 'react-native';

import { useTheme } from '../../../providers';
import { Text } from '../Text';

import { createInputStyles } from './Input.styles';

import type { InputProps, InputState } from './Input.types';
import type { IconFamily, IconComponent } from '../../../types';

const hasStringContent = (value: string | undefined): value is string =>
  value !== undefined && value !== '';

const hasRenderableNode = (
  value: React.ReactNode | string | undefined,
): value is Exclude<React.ReactNode | string, null | undefined | false> =>
  value !== null && value !== undefined && value !== false;

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      variant = 'default',
      size = 'md',
      label,
      helperText,
      errorText,
      error,
      hasError = false,
      leftIcon,
      leftIconFamily,
      rightIcon,
      rightIconFamily,
      iconSize = 20,
      iconColor,
      onLeftIconPress,
      onRightIconPress,
      required = false,
      fullWidth = false,
      disabled = false,
      readOnly = false,
      containerStyle,
      inputStyle,
      inputContainerStyle,
      labelStyle,
      helperTextStyle,
      errorTextStyle,
      style,
      onFocusChange,
      onFocus,
      onBlur,
      platform: _platform = 'auto',
      testID,
      accessibilityLabel,
      accessibilityHint,
      accessibilityRole,
      accessible,
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    /**
     * Get icon component based on icon family
     * Returns React component that accepts name, size, and color props
     */
    const getIconComponent = (family?: IconFamily): IconComponent => {
      switch (family) {
        case 'MaterialCommunityIcons':
          return MaterialCommunityIconsIcon as IconComponent;
        case 'Ionicons':
        case undefined:
        default:
          return IoniconsIcon as IconComponent;
      }
    };

    // Determine current state
    const getInputState = (): InputState => {
      if (disabled) return 'disabled';
      if (hasError || hasStringContent(errorText) || hasStringContent(error)) return 'error';
      if (isFocused) return 'focused';
      return 'default';
    };

    const currentState = getInputState();

    // Create styles based on current props and state
    const styles = createInputStyles(
      theme,
      variant,
      size,
      currentState,
      fullWidth,
      hasRenderableNode(leftIcon),
      hasRenderableNode(rightIcon),
    );

    // Handle focus events
    const handleFocus = useCallback(
      (event: Parameters<NonNullable<typeof onFocus>>[0]) => {
        if (!disabled && !readOnly) {
          setIsFocused(true);
          onFocusChange?.(true);
          onFocus?.(event);
        }
      },
      [disabled, readOnly, onFocusChange, onFocus],
    );

    const handleBlur = useCallback(
      (event: Parameters<NonNullable<typeof onBlur>>[0]) => {
        setIsFocused(false);
        onFocusChange?.(false);
        onBlur?.(event);
      },
      [onFocusChange, onBlur],
    );

    // Render label with required asterisk
    const renderLabel = () => {
      if (!hasRenderableNode(label)) return null;

      // If label is already a ReactNode (not a string), render it directly
      // WITHOUT adding another asterisk (the ReactNode may already have one)
      if (typeof label !== 'string') {
        return (
          <View style={styles.labelRow}>
            <Text style={[styles.label, labelStyle]}>{label}</Text>
          </View>
        );
      }

      // If label is a string, render with optional required asterisk
      return (
        <View style={styles.labelRow}>
          <Text style={[styles.label, labelStyle]}>{label}</Text>
          {required && <Text style={styles.requiredAsterisk}> *</Text>}
        </View>
      );
    };

    // Render helper or error text
    const renderHelperText = () => {
      const displayError = hasStringContent(error) ? error : errorText;
      if (hasStringContent(displayError)) {
        return <Text style={[styles.errorText, errorTextStyle]}>{displayError}</Text>;
      }

      if (hasStringContent(helperText)) {
        return <Text style={[styles.helperText, helperTextStyle]}>{helperText}</Text>;
      }

      return null;
    };

    /**
     * Render icon - supports both ReactNode and string-based icons
     */
    const renderIcon = (
      icon: React.ReactNode | string | undefined,
      iconFamily?: IconFamily,
    ): React.ReactNode | null => {
      if (!hasRenderableNode(icon)) return null;

      // If icon is already a React component, render it directly
      if (typeof icon !== 'string') {
        return icon;
      }

      // If icon is a string, render using icon family
      const IconComponent = getIconComponent(iconFamily);
      const color = iconColor ?? theme.colors.onSurfaceVariant;

      return <IconComponent name={icon} size={iconSize} color={color} />;
    };

    return (
      <View style={[styles.container, containerStyle, style]}>
        {renderLabel()}

        <View style={[styles.inputContainer, inputContainerStyle]}>
          {hasRenderableNode(leftIcon) &&
            (onLeftIconPress ? (
              <Pressable
                style={styles.leftIconContainer}
                onPress={onLeftIconPress}
                disabled={disabled}
              >
                {renderIcon(leftIcon, leftIconFamily)}
              </Pressable>
            ) : (
              <View style={styles.leftIconContainer}>{renderIcon(leftIcon, leftIconFamily)}</View>
            ))}

          <TextInput
            ref={ref}
            style={[styles.input, inputStyle]}
            editable={!disabled && !readOnly}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            selectionColor={theme.colors.primary}
            testID={testID}
            accessibilityLabel={
              accessibilityLabel ?? (typeof label === 'string' ? label : undefined)
            }
            accessibilityHint={accessibilityHint}
            accessibilityState={{
              disabled,
            }}
            {...rest}
          />

          {hasRenderableNode(rightIcon) &&
            (onRightIconPress ? (
              <Pressable
                style={styles.rightIconContainer}
                onPress={onRightIconPress}
                disabled={disabled}
              >
                {renderIcon(rightIcon, rightIconFamily)}
              </Pressable>
            ) : (
              <View style={styles.rightIconContainer}>
                {renderIcon(rightIcon, rightIconFamily)}
              </View>
            ))}
        </View>

        {renderHelperText()}
      </View>
    );
  },
);

Input.displayName = 'Input';
