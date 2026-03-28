/**
 * Input Component
 * Text input with label, helper text, and validation styling
 */

import React, { forwardRef, useState, useCallback } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import AntDesign from '@react-native-vector-icons/ant-design';
import Entypo from '@react-native-vector-icons/entypo';
import EvilIcons from '@react-native-vector-icons/evil-icons';
import Feather from '@react-native-vector-icons/feather';
import FontAwesome from '@react-native-vector-icons/fontawesome';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import FontAwesome6 from '@react-native-vector-icons/fontawesome6';
import Fontisto from '@react-native-vector-icons/fontisto';
import Foundation from '@react-native-vector-icons/foundation';
import Icon from '@react-native-vector-icons/ionicons';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Octicons from '@react-native-vector-icons/octicons';
import SimpleLineIcons from '@react-native-vector-icons/simple-line-icons';
import Zocial from '@react-native-vector-icons/zocial';

import { useTheme } from '../../../providers';
import { Text } from '../Text';

import { createInputStyles } from './Input.styles';

import type { InputProps, InputState } from './Input.types';
import type { IconFamily, IconComponent } from '../../../types';

export const Input = forwardRef<TextInput, InputProps>(
  function Input(
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
  ) {
    const theme = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    /**
     * Get icon component based on icon family
     * Returns React component that accepts name, size, and color props
     */
    const getIconComponent = (family?: IconFamily): IconComponent => {
      switch (family) {
        case 'AntDesign':
          return AntDesign as IconComponent;
        case 'Entypo':
          return Entypo as IconComponent;
        case 'EvilIcons':
          return EvilIcons as IconComponent;
        case 'Feather':
          return Feather as IconComponent;
        case 'FontAwesome':
          return FontAwesome as IconComponent;
        case 'FontAwesome5':
          return FontAwesome5 as IconComponent;
        case 'FontAwesome6':
          return FontAwesome6 as IconComponent;
        case 'Fontisto':
          return Fontisto as IconComponent;
        case 'Foundation':
          return Foundation as IconComponent;
        case 'MaterialCommunityIcons':
          return MaterialCommunityIcons as IconComponent;
        case 'MaterialIcons':
          return MaterialIcons as IconComponent;
        case 'Octicons':
          return Octicons as IconComponent;
        case 'SimpleLineIcons':
          return SimpleLineIcons as IconComponent;
        case 'Zocial':
          return Zocial as IconComponent;
        case 'Ionicons':
        default:
          return Icon as IconComponent;
      }
    };

    // Determine current state
    const getInputState = (): InputState => {
      if (disabled) return 'disabled';
      if (hasError || errorText || error) return 'error';
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
      !!leftIcon,
      !!rightIcon,
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
      if (!label) return null;

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
      const displayError = error || errorText;
      if (displayError) {
        return <Text style={[styles.errorText, errorTextStyle]}>{displayError}</Text>;
      }

      if (helperText) {
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
      if (!icon) return null;

      // If icon is already a React component, render it directly
      if (typeof icon !== 'string') {
        return icon;
      }

      // If icon is a string, render using icon family
      const IconComponent = getIconComponent(iconFamily);
      const color = iconColor || theme.colors.onSurfaceVariant;

      return <IconComponent name={icon} size={iconSize} color={color} />;
    };

    return (
      <View style={[styles.container, containerStyle, style]}>
        {renderLabel()}

        <View style={[styles.inputContainer, inputContainerStyle]}>
          {leftIcon &&
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
              accessibilityLabel || (typeof label === 'string' ? label : undefined)
            }
            accessibilityHint={accessibilityHint}
            accessibilityState={{
              disabled,
            }}
            {...rest}
          />

          {rightIcon &&
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

