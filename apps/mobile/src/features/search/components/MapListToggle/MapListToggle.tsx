/**
 * MapListToggle Component
 *
 * Beautiful toggle buttons for switching between Map and List views.
 * Features:
 * - Animated selection indicator
 * - Map icon (default, green when active)
 * - List icon
 * - Smooth press animations
 * - Accessible labels
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

// ============================================================================
// Types
// ============================================================================

export type ViewMode = 'map' | 'list';

interface MapListToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  style?: object;
}

// ============================================================================
// Component
// ============================================================================

const TOGGLE_SHADOW = '#000';

export const MapListToggle: React.FC<MapListToggleProps> = ({ value, onChange, style }) => {
  const theme = useTheme();
  const [slideAnim] = useState(() => new Animated.Value(value === 'map' ? 0 : 1));
  const translateX = useMemo(
    () =>
      slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 82], // Half of container width - padding
      }),
    [slideAnim],
  );

  // Animate the selection indicator
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: value === 'map' ? 0 : 1,
      damping: 20,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [value, slideAnim]);

  const handleMapPress = () => {
    if (value !== 'map') {
      onChange('map');
    }
  };

  const handleListPress = () => {
    if (value !== 'list') {
      onChange('list');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }, style]}>
      {/* Animated Selection Indicator */}
      <Animated.View
        style={[
          styles.selectionIndicator,
          {
            backgroundColor: theme.colors.background,
            transform: [{ translateX }],
          },
        ]}
      />

      {/* Map Button */}
      <Pressable
        style={styles.button}
        onPress={handleMapPress}
        accessibilityRole='button'
        accessibilityLabel='Map view'
        accessibilityState={{ selected: value === 'map' }}
      >
        <Icon
          name='map-outline'
          family='Ionicons'
          size={18}
          color={value === 'map' ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
        <Text
          variant='label'
          size='sm'
          weight={value === 'map' ? 'bold' : 'medium'}
          color={value === 'map' ? 'primary' : 'secondary'}
          lineHeight={20}
          style={styles.buttonText}
        >
          Map
        </Text>
      </Pressable>

      {/* List Button */}
      <Pressable
        style={styles.button}
        onPress={handleListPress}
        accessibilityRole='button'
        accessibilityLabel='List view'
        accessibilityState={{ selected: value === 'list' }}
      >
        <Icon
          name='list-outline'
          family='Ionicons'
          size={18}
          color={value === 'list' ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
        <Text
          variant='label'
          size='sm'
          weight={value === 'list' ? 'bold' : 'medium'}
          color={value === 'list' ? 'primary' : 'secondary'}
          lineHeight={20}
          style={styles.buttonText}
        >
          List
        </Text>
      </Pressable>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 2,
    width: 164,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 80,
    height: 38,
    borderRadius: 10,
    shadowColor: TOGGLE_SHADOW,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    zIndex: 1,
  },
  buttonText: {
    marginLeft: 4,
  },
});
