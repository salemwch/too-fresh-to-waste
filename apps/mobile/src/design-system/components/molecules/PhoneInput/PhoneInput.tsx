/**
 * PhoneInput Component
 * International phone number input with country selector
 *
 * Features:
 * - Country code selection with flag picker
 * - Real-time phone number formatting
 * - E.164 format output
 * - Support for Tunisia (TN) as default country
 * - Validation feedback
 * - Accessibility support
 *
 * @example
 * ```tsx
 * <PhoneInput
 *   value={phoneNumber}
 *   onChangeText={setPhoneNumber}
 *   countryCode={country}
 *   onCountryChange={setCountry}
 *   label="Phone number"
 *   required
 * />
 * ```
 */

import React, { forwardRef, useState, useCallback, useMemo, useEffect } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import CountryPicker from 'react-native-country-picker-modal';

import {
  formatAsYouType,
  getCallingCode,
  cleanPhoneNumber,
  getE164Format,
  getMaxPhoneLength,
  enforceMaxLength,
  validatePhoneLengthForCountry,
  DEFAULT_COUNTRY,
  SUPPORTED_COUNTRIES,
} from '../../../../utils/phone';
import { useTheme } from '../../../providers';
import { Text } from '../../atoms/Text';

import { createPhoneInputStyles } from './PhoneInput.styles';

import type { PhoneInputProps, PhoneInputState } from './PhoneInput.types';
import type { CountryCode } from 'libphonenumber-js';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import type { Country, CountryCode as RNCountryCode } from 'react-native-country-picker-modal';

export const PhoneInput = React.memo(forwardRef<TextInput, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChangeText,
      countryCode = DEFAULT_COUNTRY,
      onCountryChange,
      label,
      helperText,
      errorText,
      hasError = false,
      required = false,
      showCountryPicker = true,
      enableAutoFormat = true,
      allowedCountries = SUPPORTED_COUNTRIES,
      containerStyle,
      inputContainerStyle,
      inputStyle,
      labelStyle,
      helperTextStyle,
      errorTextStyle,
      countryPickerStyle,
      disabled = false,
      readOnly = false,
      testID,
      accessibilityLabel,
      accessibilityHint,
      ...rest
    },
    ref,
  ) {
    const theme = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [internalCountry, setInternalCountry] = useState<CountryCode>(countryCode);

    // Update internal country when prop changes
    useEffect(() => {
      setInternalCountry(countryCode);
    }, [countryCode]);

    // When country changes, validate current phone number against new country's max length
    // If too long for new country, truncate it
    useEffect(() => {
      if (value && value.trim()) {
        const cleaned = cleanPhoneNumber(value);
        const lengthStatus = validatePhoneLengthForCountry(cleaned, internalCountry);

        // If phone number is too long for the new country, enforce max length
        if (lengthStatus === 'TOO_LONG') {
          const enforced = enforceMaxLength(cleaned, internalCountry);
          const formatted = enableAutoFormat
            ? formatAsYouType(enforced, internalCountry)
            : enforced;
          onChangeText(formatted);
        }
      }
    }, [internalCountry]); // Only run when country changes

    // Determine current state
    const getInputState = (): PhoneInputState => {
      if (disabled) return 'disabled';
      if (hasError || errorText) return 'error';
      if (isFocused) return 'focused';
      return 'default';
    };

    const currentState = getInputState();
    const styles = createPhoneInputStyles(theme, currentState, hasError || !!errorText);

    // Get calling code for current country
    const callingCode = useMemo(() => getCallingCode(internalCountry), [internalCountry]);

    // Get maximum phone number length for current country (national digits only)
    // This is used to count DIGITS (not characters) and block typing beyond limit
    // Example: Tunisia allows 8 digits, USA allows 10 digits
    const maxPhoneDigits = useMemo(() => getMaxPhoneLength(internalCountry), [internalCountry]);

    // We DON'T use character-based maxLength because formatting varies during typing
    // Instead, we use digit-based blocking in handlePhoneChange AND onKeyPress
    // Safety maxLength is set high to allow formatting characters
    const safetyMaxLength = 25; // High enough for any formatted international number

    /**
     * Handle key press events - Layer 3 defense for ZERO-FLICKER blocking
     *
     * This intercepts keyboard input BEFORE the character appears in the TextInput.
     * Unlike handlePhoneChange (which runs AFTER native input updates), this runs
     * BEFORE, providing true keyboard-level blocking with zero visual flicker.
     *
     * Production-ready approach used by: WhatsApp, Uber, Twilio, Auth0, Firebase
     */
    const handleKeyPress = useCallback(
      (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        const key = event.nativeEvent.key;

        // Only check numeric keys (allow backspace, delete, navigation, etc.)
        if (!/[0-9]/.test(key)) return;

        // Get current digit count from current value
        const currentCleaned = cleanPhoneNumber(value);
        const currentDigits = currentCleaned.replace(/\+/g, '');

        // Calculate max digits allowed for current country
        let maxAllowed = maxPhoneDigits;

        if (currentCleaned.startsWith('+') && callingCode) {
          // International format: country code + national digits
          // Example: Tunisia = 3 (216) + 8 digits = 11 total
          maxAllowed = callingCode.length + maxPhoneDigits;
        }

        // BLOCK the keypress if at limit (character NEVER appears!)
        if (currentDigits.length >= maxAllowed) {
          event.preventDefault(); // ← TRUE keyboard-level blocking!
        }
      },
      [value, maxPhoneDigits, callingCode],
    );

    /**
     * Convert country code to flag emoji
     * Example: 'TN' -> '🇹🇳', 'US' -> '🇺🇸'
     */
    const getCountryFlagEmoji = useCallback((countryCode: string): string => {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    }, []);

    /**
     * Handle country selection
     */
    const handleCountrySelect = useCallback(
      (country: Country) => {
        const newCountry = country.cca2 as CountryCode;
        setInternalCountry(newCountry);
        onCountryChange?.(newCountry);
        setShowPicker(false);
      },
      [onCountryChange],
    );

    /**
     * Handle phone number change with auto-formatting and digit count limiting
     *
     * Layer 1 Defense (Fallback validation):
     * - Extracts only DIGITS from input (ignores formatting)
     * - Compares digit count against country-specific max
     * - Blocks BEFORE updating state
     * - Tunisia: 8 digits max, USA: 10 digits max, France: 9 digits max
     *
     * Note: Layer 3 (onKeyPress) now provides primary blocking at keyboard level.
     * This function serves as a fallback for edge cases (paste, autocomplete, etc.)
     *
     * Production-ready like: WhatsApp, Uber, Twilio, etc.
     */
    const handlePhoneChange = useCallback(
      (text: string) => {
        // Step 1: Clean the input (extract only digits and +)
        const cleaned = cleanPhoneNumber(text);

        // Step 2: Extract ONLY digits (remove + sign for counting)
        const digitsOnly = cleaned.replace(/\+/g, '');

        // Step 3: Determine max digits allowed
        // If user is typing international format (+216...), allow country code + national digits
        // If user is typing national format (24201314), allow only national digits
        let maxDigitsAllowed = maxPhoneDigits;

        if (cleaned.startsWith('+') && callingCode) {
          // International format: +216 + 8 digits = 11 total digits
          maxDigitsAllowed = callingCode.length + maxPhoneDigits;
        }

        // Step 4: BLOCK if too many digits (this prevents typing!)
        if (digitsOnly.length > maxDigitsAllowed) {
          // DON'T call onChangeText - this prevents the character from appearing!
          return;
        }

        // Step 5: Format and update (only if digit count is valid)
        if (enableAutoFormat) {
          const formatted = formatAsYouType(cleaned, internalCountry);
          onChangeText(formatted);
        } else {
          onChangeText(cleaned);
        }
      },
      [enableAutoFormat, internalCountry, onChangeText, maxPhoneDigits, callingCode],
    );

    /**
     * Handle focus events
     */
    const handleFocus = useCallback(
      (event: Parameters<NonNullable<typeof rest.onFocus>>[0]) => {
        if (!disabled && !readOnly) {
          setIsFocused(true);
          rest.onFocus?.(event);
        }
      },
      [disabled, readOnly, rest],
    );

    const handleBlur = useCallback(
      (event: Parameters<NonNullable<typeof rest.onBlur>>[0]) => {
        setIsFocused(false);

        // Convert to E.164 format on blur
        if (value && value.trim()) {
          const e164 = getE164Format(value, internalCountry);
          if (e164) {
            onChangeText(e164);
          }
        }

        rest.onBlur?.(event);
      },
      [value, internalCountry, onChangeText, rest],
    );

    /**
     * Render label with required asterisk
     */
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

    /**
     * Render helper or error text
     */
    const renderHelperText = () => {
      if (errorText) {
        return <Text style={[styles.errorText, errorTextStyle]}>{errorText}</Text>;
      }

      if (helperText) {
        return <Text style={[styles.helperText, helperTextStyle]}>{helperText}</Text>;
      }

      return null;
    };

    /**
     * Render country picker button
     */
    const renderCountryPicker = () => {
      if (!showCountryPicker) return null;

      const flagEmoji = getCountryFlagEmoji(internalCountry);

      return (
        <Pressable
          style={[
            styles.countryPickerButton,
            disabled && styles.countryPickerDisabled,
            countryPickerStyle,
          ]}
          onPress={() => !disabled && !readOnly && setShowPicker(true)}
          disabled={disabled || readOnly}
          testID={`${testID}-country-picker`}
          accessibilityLabel='Select country code'
          accessibilityRole='button'
        >
          <CountryPicker
            countryCode={internalCountry as RNCountryCode}
            withFilter
            withFlag
            withCallingCode
            withEmoji
            onSelect={handleCountrySelect}
            visible={showPicker}
            onClose={() => setShowPicker(false)}
            containerButtonStyle={{
              display: 'none', // Hide default button, we use our custom UI
            }}
            countryCodes={allowedCountries as RNCountryCode[]}
          />
          <Text style={styles.flagEmoji}>{flagEmoji}</Text>
          <Text style={styles.callingCode}>{callingCode ? `+${callingCode}` : ''}</Text>
        </Pressable>
      );
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {renderLabel()}

        <View style={[styles.inputContainer, inputContainerStyle]}>
          {renderCountryPicker()}

          <TextInput
            ref={ref}
            style={[styles.input, disabled && styles.inputDisabled, inputStyle]}
            value={value}
            onKeyPress={handleKeyPress} // Layer 3: Keyboard-level blocking (ZERO flicker!)
            onChangeText={handlePhoneChange} // Layer 1: Digit-based validation (fallback)
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={!disabled && !readOnly}
            maxLength={safetyMaxLength} // Layer 2: Safety limit for formatted characters
            keyboardType='phone-pad'
            autoComplete='tel'
            textContentType='telephoneNumber'
            dataDetectorTypes='phoneNumber'
            placeholderTextColor={theme.colors.onSurfaceVariant}
            selectionColor={theme.colors.primary}
            testID={testID}
            accessibilityLabel={
              accessibilityLabel || (typeof label === 'string' ? label : undefined)
            }
            accessibilityHint={accessibilityHint || 'Enter your phone number'}
            accessibilityState={{
              disabled,
            }}
            {...rest}
          />
        </View>

        {renderHelperText()}
      </View>
    );
  },
));

export default PhoneInput;
