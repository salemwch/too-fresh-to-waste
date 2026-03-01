/**
 * Controlled Input Component
 * React Hook Form integrated text input
 *
 * Production Standards:
 * - Accessibility built-in
 * - Error display
 * - Loading state
 * - Type-safe
 */

import React from 'react';
import { Controller } from 'react-hook-form';

import { Input } from '@/design-system/components/atoms';

import type { InputProps } from '@/design-system/components/atoms/Input/Input.types';
import type { Control, FieldValues, Path } from 'react-hook-form';

interface ControlledInputProps<T extends FieldValues> extends Omit<
  InputProps,
  'value' | 'onChangeText'
> {
  control: Control<T>;
  name: Path<T>;
  defaultValue?: string;
}

export function ControlledInput<T extends FieldValues>({
  control,
  name,
  defaultValue = '',
  ...inputProps
}: ControlledInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      defaultValue={defaultValue as any}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => {
        // Conditional spreading for exactOptionalPropertyTypes compliance
        const accessibilityLabel =
          inputProps['accessibilityLabel'] ||
          (typeof inputProps.label === 'string' ? inputProps.label : undefined);
        const accessibilityHint = error?.message || inputProps.accessibilityHint;
        const accessibilityState =
          inputProps.disabled !== undefined ? { disabled: inputProps.disabled } : undefined;

        return (
          <Input
            {...inputProps}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            {...(error?.message && { error: error.message })}
            {...(accessibilityLabel && { accessibilityLabel })}
            {...(accessibilityHint && { accessibilityHint })}
            {...(accessibilityState && { accessibilityState })}
          />
        );
      }}
    />
  );
}

/**
 * Usage Example:
 *
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { yupResolver } from '@hookform/resolvers/yup';
 * import { ControlledInput } from '@/components/Form';
 * import { loginSchema } from '@/utils/validation';
 *
 * function LoginForm() {
 *   const { control, handleSubmit } = useForm({
 *     resolver: yupResolver(loginSchema),
 *   });
 *
 *   return (
 *     <>
 *       <ControlledInput
 *         control={control}
 *         name="email"
 *         label="Email"
 *         keyboardType="email-address"
 *         autoCapitalize="none"
 *       />
 *       <ControlledInput
 *         control={control}
 *         name="password"
 *         label="Password"
 *         secureTextEntry
 *       />
 *     </>
 *   );
 * }
 * ```
 */
