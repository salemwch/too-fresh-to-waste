/**
 * FormField Molecule
 * Production-ready form field with validation, sanitization, and accessibility
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Pressable } from 'react-native';

import { useTheme } from '../../../providers';
import { Input } from '../../atoms/Input';

import type { FormFieldProps } from './FormField.types';

// Security: Input sanitization patterns
const VALIDATION_PATTERNS = {
  text: /^[\w\s\-_.,!?@#$%&*()+=[\]{}|\\:";'<>?,./]*$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  password: /^[\w\s\-_.,!?@#$%&*()+=[\]{}|\\:";'<>?,./]*$/, // Allow all printable chars for passwords
  phone: /^[\d\s\-+()\.]*$/,
  number: /^[\d\-+.]*$/,
  url: /^https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=]+$/,
};

// Password visibility icon placeholders
const EyeIcon = () => (
  <View style={{ width: 20, height: 20, backgroundColor: '#666', borderRadius: 4 }} />
);

const EyeOffIcon = () => (
  <View style={{ width: 20, height: 20, backgroundColor: '#999', borderRadius: 4 }} />
);

export const FormField = React.memo<FormFieldProps>(function FormField({
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
}) {
  const theme = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  // Determine validation pattern
  const getValidationPattern = useMemo(() => {
    if (validationPattern) return validationPattern;
    return VALIDATION_PATTERNS[type] || VALIDATION_PATTERNS.text;
  }, [validationPattern, type]);

  // Input sanitization
  const sanitizeInput = useCallback(
    (text: string): string => {
      // Apply validation pattern
      if (!getValidationPattern.test(text)) {
        // Remove invalid characters
        return text.replace(new RegExp(`[^${getValidationPattern.source.slice(1, -1)}]`, 'g'), '');
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
        return `${label || 'Field'} is required`;
      }

      // Length validation
      if (fieldValue.length < minLength) {
        return `${label || 'Field'} must be at least ${minLength} characters`;
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
    const props: any = {
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
    }

    // Override with explicit props
    if (keyboardType) props.keyboardType = keyboardType;
    if (textContentType) props.textContentType = textContentType;
    if (autoComplete !== 'off') props.autoComplete = autoComplete;

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
    if (rightIcon) return rightIcon;

    if (type === 'password' && showPasswordToggle) {
      return (
        <Pressable
          onPress={togglePasswordVisibility}
          style={{ padding: 0 }}
          testID={`${testID}-password-toggle`}
          accessibilityRole='button'
          accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
        >
          {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
        </Pressable>
      );
    }

    return undefined;
  }, [
    rightIcon,
    type,
    showPasswordToggle,
    togglePasswordVisibility,
    theme.spacing.base.xs,
    testID,
    isPasswordVisible,
  ]);

  // Determine current error state
  const currentError = errorText || internalError;
  const hasCurrentError = hasError || !!currentError;

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
        errorText={currentError || undefined}
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
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={accessibilityHint}
        {...getInputProps}
        {...rest}
      />
    </View>
  );
});

