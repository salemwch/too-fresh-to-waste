/**
 * PhoneInput Component Styles
 */

import { StyleSheet } from 'react-native';

import type { PhoneInputState } from './PhoneInput.types';
import type { ThemeContextValue } from '../../../types';

export const createPhoneInputStyles = (
  theme: ThemeContextValue,
  state: PhoneInputState,
  hasError: boolean,
) => {
  // Determine border color based on state
  const getBorderColor = () => {
    if (hasError) return theme.colors.error;
    if (state === 'focused') return theme.colors.primary;
    if (state === 'disabled') return theme.colors.outlineVariant;
    return theme.colors.outline;
  };

  // Determine background color based on state
  const getBackgroundColor = () => {
    if (state === 'disabled') return theme.colors.surface;
    return theme.colors.surfaceVariant;
  };

  return StyleSheet.create({
    container: {
      width: '100%',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.onSurface,
    },
    requiredAsterisk: {
      fontSize: 14,
      color: theme.colors.error,
      marginLeft: 2,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: getBorderColor(),
      borderRadius: 8,
      backgroundColor: getBackgroundColor(),
      minHeight: 48,
    },
    countryPickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRightWidth: 1,
      borderRightColor: theme.colors.outlineVariant,
      minWidth: 100,
    },
    countryPickerDisabled: {
      opacity: 0.5,
    },
    flagContainer: {
      marginRight: 8,
    },
    flagText: {
      fontSize: 24,
    },
    flagEmoji: {
      fontSize: 22,
      lineHeight: 22,
      marginRight: 6,
    },
    callingCode: {
      fontSize: 16,
      color: theme.colors.onSurface,
      fontWeight: '500',
      marginRight: 4,
    },
    chevronIcon: {
      marginLeft: 2,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.onSurface,
      paddingHorizontal: 12,
      paddingVertical: 12,
      height: 48,
    },
    inputDisabled: {
      color: theme.colors.onSurfaceVariant,
      opacity: 0.6,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
      marginLeft: 12,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: 4,
      marginLeft: 12,
    },
    countryModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    countryModalContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    countryModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    countryModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    countryModalCloseButton: {
      padding: 8,
    },
    countryList: {
      paddingVertical: 8,
    },
    countryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    countryItemSelected: {
      backgroundColor: theme.colors.primaryContainer,
    },
    countryItemFlag: {
      marginRight: 12,
    },
    countryItemText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    countryItemCode: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
  });
};
