/**
 * FormField Molecule
 * Production-ready form field with validation, sanitization, and accessibility
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../providers';
import { Input } from '../../atoms/Input';

import type { FormFieldProps } from './FormField.types';
import type { InputProps } from '../../atoms/Input';

// Security: Input sanitization patterns
const VALIDATION_PATTERNS: Record<NonNullable<FormFieldProps['type']>, RegExp> = {
  text: /^[\w\s\-_.,!?@#$%&*()+=[\]{}|\\:";'<>?,./]*$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  password: /^[\w\s\-_.,!?@#$%&*()+=[\]{}|\\:";'<>?,./]*$/, // Allow all printable chars for passwords
  phone: /^[\d\s\-+()\.]*$/,
  number: /^[\d\-+.]*$/,
  url: /^https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=]+$/,
};

const hasRenderableNode = (
  value: React.ReactNode | undefined,
): value is Exclude<React.ReactNode, null | undefined | false> =>
  value !== null && value !== undefined && value !== false;

const resolveAutoComplete = (
  autoComplete: FormFieldProps['autoComplete'],
): InputProps['autoComplete'] => {
  if (autoComplete === 'address') return 'street-address';
  if (autoComplete === 'phone') return 'tel';
  return autoComplete;
};

// Password visibility icon placeholders
const EyeIcon = ({ backgroundColor }: { backgroundColor: string }) => (
  <View style={[styles.visibilityIcon, { backgroundColor }]} />
);

const EyeOffIcon = ({ backgroundColor }: { backgroundColor: string }) => (
  <View style={[styles.visibilityIcon, { backgroundColor }]} />
);

export const FormField = memo<FormFieldProps>(
  ({
    label,
    value,
    onChangeText,
    placeholder,
    helperText,
    errorText,
    hasError = false,
    required = false,
    disabled = false,
    type = 'text',
    validationPattern,
    maxLength = 255,
    minLength = 0,
    validateOnChange = false,
    validator,
    leftIcon,
    rightIcon,
    showPasswordToggle = true,
    size = 'md',
    variant = 'default',
    autoComplete = 'off',
    textContentType,
    keyboardType,
    autoCapitalize = 'sentences',
    autoCorrect = true,
    spellCheck = true,
    containerStyle,
    labelStyle,
    inputStyle,
    helperTextStyle,
    errorTextStyle,
    onBlur,
    onFocus,
    onSubmit,
    testID = 'form-field',
    accessibilityLabel,
    accessibilityHint,
    ...rest
  }) => {
    const theme = useTheme();
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [internalError, setInternalError] = useState<string | null>(null);
    const [isTouched, setIsTouched] = useState(false);

    // Determine validation pattern
    const getValidationPattern = useMemo(() => {
      if (validationPattern) return validationPattern;
      return VALIDATION_PATTERNS[type];
    }, [validationPattern, type]);

    // Input sanitization
    const sanitizeInput = useCallback(
      (text: string): string => {
        // Apply validation pattern
        if (!getValidationPattern.test(text)) {
          // Remove invalid characters
          return text.replace(
            new RegExp(`[^${getValidationPattern.source.slice(1, -1)}]`, 'g'),
            '',
          );
        }

        // Apply length limits
        return text.slice(0, maxLength);
      },
      [getValidationPattern, maxLength],
    );

    // Field validation
    const validateField = useCallback(
      (fieldValue: string): string | null => {
        // Required validation
        if (required && !fieldValue.trim()) {
          return `${label ?? 'Field'} is required`;
        }

        // Length validation
        if (fieldValue.length < minLength) {
          return `${label ?? 'Field'} must be at least ${minLength} characters`;
        }

        // Type-specific validation
        switch (type) {
          case 'email':
            if (fieldValue && !VALIDATION_PATTERNS.email.test(fieldValue)) {
              return 'Please enter a valid email address';
            }
            break;
          case 'phone':
            if (fieldValue && fieldValue.replace(/\D/g, '').length < 10) {
              return 'Please enter a valid phone number';
            }
            break;
          case 'url':
            if (fieldValue && !VALIDATION_PATTERNS.url.test(fieldValue)) {
              return 'Please enter a valid URL';
            }
            break;
          case 'number':
          case 'password':
          case 'text':
            break;
        }

        // Custom validation
        if (validator) {
          return validator(fieldValue);
        }

        return null;
      },
      [required, label, minLength, type, validator],
    );

    // Handle text change
    const handleChangeText = useCallback(
      (text: string) => {
        const sanitizedText = sanitizeInput(text);
        onChangeText(sanitizedText);

        // Validate on change if enabled
        if (validateOnChange && isTouched) {
          const validationError = validateField(sanitizedText);
          setInternalError(validationError);
        }
      },
      [sanitizeInput, onChangeText, validateOnChange, isTouched, validateField],
    );

    // Handle blur
    const handleBlur = useCallback(() => {
      setIsTouched(true);
      const validationError = validateField(value);
      setInternalError(validationError);
      onBlur?.();
    }, [validateField, value, onBlur]);

    // Handle focus
    const handleFocus = useCallback(() => {
      onFocus?.();
    }, [onFocus]);

    // Toggle password visibility
    const togglePasswordVisibility = useCallback(() => {
      setIsPasswordVisible(prev => !prev);
    }, []);

    // Determine input properties based on type
    const getInputProps = useMemo(() => {
      const resolvedAutoComplete = resolveAutoComplete(autoComplete);
      const props: Partial<InputProps> = {
        autoCorrect,
        spellCheck,
        autoCapitalize,
      };

      switch (type) {
        case 'email':
          props.keyboardType = 'email-address';
          props.autoComplete = 'email';
          props.textContentType = 'emailAddress';
          props.autoCapitalize = 'none';
          props.autoCorrect = false;
          props.spellCheck = false;
          break;
        case 'password':
          props.secureTextEntry = !isPasswordVisible;
          props.autoComplete = 'password';
          props.textContentType = 'password';
          props.autoCapitalize = 'none';
          props.autoCorrect = false;
          props.spellCheck = false;
          break;
        case 'phone':
          props.keyboardType = 'phone-pad';
          props.textContentType = 'telephoneNumber';
          props.autoComplete = 'tel';
          break;
        case 'number':
          props.keyboardType = 'numeric';
          break;
        case 'url':
          props.keyboardType = 'url';
          props.autoCapitalize = 'none';
          props.autoCorrect = false;
          break;
        case 'text':
        default:
          break;
      }

      // Override with explicit props
      if (keyboardType) props.keyboardType = keyboardType;
      if (textContentType) props.textContentType = textContentType;
      if (resolvedAutoComplete !== 'off') props.autoComplete = resolvedAutoComplete;

      return props;
    }, [
      type,
      isPasswordVisible,
      keyboardType,
      textContentType,
      autoComplete,
      autoCorrect,
      spellCheck,
      autoCapitalize,
    ]);

    // Determine right icon
    const getRightIcon = useMemo(() => {
      if (hasRenderableNode(rightIcon)) return rightIcon;

      if (type === 'password' && showPasswordToggle) {
        return (
          <Pressable
            onPress={togglePasswordVisibility}
            style={styles.passwordToggle}
            testID={`${testID}-password-toggle`}
            accessibilityRole='button'
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            accessibilityHint='Toggles password visibility'
          >
            {isPasswordVisible ? (
              <EyeOffIcon backgroundColor={theme.colors.outline} />
            ) : (
              <EyeIcon backgroundColor={theme.colors.onSurfaceVariant} />
            )}
          </Pressable>
        );
      }

      return undefined;
    }, [
      rightIcon,
      type,
      showPasswordToggle,
      togglePasswordVisibility,
      testID,
      isPasswordVisible,
      theme.colors.onSurfaceVariant,
      theme.colors.outline,
    ]);

    // Determine current error state
    const currentError = errorText ?? internalError;
    const hasCurrentError =
      hasError || (currentError !== null && currentError !== undefined && currentError !== '');

    return (
      <View style={[containerStyle]} testID={testID}>
        <Input
          label={label}
          value={value}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          helperText={!hasCurrentError ? helperText : undefined}
          errorText={currentError ?? undefined}
          hasError={hasCurrentError}
          required={required}
          disabled={disabled}
          leftIcon={leftIcon}
          rightIcon={getRightIcon}
          size={size}
          variant={variant}
          maxLength={maxLength}
          style={inputStyle}
          labelStyle={labelStyle}
          helperTextStyle={helperTextStyle}
          errorTextStyle={errorTextStyle}
          testID={`${testID}-input`}
          {...(accessibilityLabel !== undefined
            ? { accessibilityLabel }
            : label !== undefined
              ? { accessibilityLabel: label }
              : {})}
          {...(accessibilityHint !== undefined ? { accessibilityHint } : {})}
          {...getInputProps}
          {...rest}
        />
      </View>
    );
  },
);

FormField.displayName = 'FormField';

const styles = StyleSheet.create({
  passwordToggle: {
    padding: 0,
  },
  visibilityIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
});
