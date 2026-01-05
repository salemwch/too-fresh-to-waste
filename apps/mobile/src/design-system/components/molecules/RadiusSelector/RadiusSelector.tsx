/**
 * RadiusSelector Component
 *
 * Allows user to select a search radius from preset options.
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { useTheme } from '../../../providers';
import { Text } from '../../atoms';

import type { RadiusSelectorProps } from './RadiusSelector.types';

const DEFAULT_PRESETS = [5, 10, 25, 50];

export const RadiusSelector: React.FC<RadiusSelectorProps> = ({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  variant = 'chips',
  label,
  disabled = false,
  style,
  testID,
}) => {
  const theme = useTheme();

  const handleSelect = useCallback(
    (radiusKm: number) => {
      if (!disabled) {
        onChange(radiusKm);
      }
    },
    [disabled, onChange],
  );

  const renderPreset = useCallback(
    (radiusKm: number) => {
      const isSelected = value === radiusKm;
      const buttonStyle = [
        styles.presetButton,
        variant === 'chips' ? styles.chip : styles.button,
        {
          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceVariant,
          borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
          opacity: disabled ? 0.5 : 1,
        },
      ];

      return (
        <TouchableOpacity
          key={radiusKm}
          style={buttonStyle}
          onPress={() => handleSelect(radiusKm)}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ checked: isSelected, disabled }}
          accessibilityLabel={`${radiusKm} kilometers`}
        >
          <Text
            variant="label"
            size="sm"
            weight={isSelected ? 'semibold' : 'medium'}
            style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}
          >
            {radiusKm} km
          </Text>
        </TouchableOpacity>
      );
    },
    [value, variant, theme.colors, disabled, handleSelect],
  );

  return (
    <View style={[styles.container, style]} testID={testID} accessibilityRole="radiogroup">
      {label && (
        <Text variant="label" size="sm" color="secondary" style={styles.label}>
          {label}
        </Text>
      )}
      <View style={styles.presetsRow}>{presets.map(renderPreset)}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  label: {
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
});

RadiusSelector.displayName = 'RadiusSelector';

export default RadiusSelector;
