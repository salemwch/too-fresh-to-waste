/**
 * Controlled Checkbox Component
 * React Hook Form integrated checkbox
 *
 * Production Standards:
 * - Accessibility built-in
 * - Error display
 * - Type-safe
 */

import React from 'react';
import { Controller } from 'react-hook-form';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { Control, FieldValues, Path } from 'react-hook-form';

interface ControlledCheckboxProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  defaultValue?: boolean;
  disabled?: boolean;
}

export function ControlledCheckbox<T extends FieldValues>({
  control,
  name,
  label,
  description,
  defaultValue = false,
  disabled = false,
}: ControlledCheckboxProps<T>) {
  const theme = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      defaultValue={defaultValue as any}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => !disabled && onChange(!value)}
            disabled={disabled}
            accessibilityRole='checkbox'
            accessibilityLabel={label}
            accessibilityState={{
              checked: value,
              disabled,
            }}
            accessibilityHint={description}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: error ? theme.colors.error : theme.colors.outline,
                  backgroundColor: value ? theme.colors.primary : 'transparent',
                },
                disabled && styles.checkboxDisabled,
              ]}
            >
              {value && (
                <Icon name='checkmark' family='Ionicons' size={16} color={theme.colors.onPrimary} />
              )}
            </View>

            <View style={styles.labelContainer}>
              <Text
                variant='body'
                size='md'
                style={[
                  styles.label,
                  { color: disabled ? theme.colors.outline : theme.colors.onSurface },
                ]}
              >
                {label}
              </Text>
              {description && (
                <Text variant='body' size='sm' color='secondary' style={styles.description}>
                  {description}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {error && (
            <Text variant='body' size='sm' style={[styles.error, { color: theme.colors.error }]}>
              {error.message}
            </Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    marginBottom: 4,
  },
  description: {
    lineHeight: 20,
  },
  error: {
    marginTop: 4,
    marginLeft: 36,
  },
});

/**
 * Usage Example:
 *
 * ```tsx
 * <ControlledCheckbox
 *   control={control}
 *   name="agreeToTerms"
 *   label="I agree to the Terms and Conditions"
 *   description="You must accept our terms to continue"
 * />
 * ```
 */
