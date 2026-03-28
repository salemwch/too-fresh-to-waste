/**
 * LocationHeader Component
 * Reusable header showing current location with dropdown
 *
 * Features:
 * - Displays chosen location (GPS or manual)
 * - Truncates long location names (> 20 chars)
 * - Customizable onPress handler
 * - Accessible with proper ARIA labels
 *
 * Design:
 * - Green circle (#005250) with location icon
 * - "Chosen Location" label
 * - Location name with ellipsis for overflow
 * - Chevron down indicator
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useLocation } from '@/hooks/useLocation';

// ============================================================================
// Types
// ============================================================================

interface LocationHeaderProps {
  /**
   * Custom onPress handler
   * If not provided, no action occurs
   */
  onPress?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const LocationHeader: React.FC<LocationHeaderProps> = ({ onPress }) => {
  const theme = useTheme();

  /**
   * ✅ PRODUCTION FIX: Use selector instead of manual formatting
   *
   * **Why this is better:**
   * - Selector is memoized (better performance)
   * - Formatting logic centralized in Redux (DRY)
   * - Handles rehydration races safely (no crashes)
   * - Runtime type guards prevent undefined.length errors
   * - Always returns a safe string (never null/undefined)
   *
   * **What changed:**
   * - Removed formatLocationName() - moved to selector
   * - Removed getDisplayLocation() - moved to selector
   * - Component now just renders pre-formatted data
   * - No more defensive checks needed in UI
   */
  const { formattedLocationDisplay } = useLocation();

  return (
    <Pressable
      style={styles.locationHeader}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={`Current location: ${formattedLocationDisplay}`}
      accessibilityHint='Tap to change your location'
      disabled={!onPress}
    >
      {/* Location Icon Circle - #005250 */}
      <View style={styles.locationIconCircle}>
        <Icon name='location' family='Ionicons' size={16} color='#FFFFFF' />
      </View>

      {/* Location Text Container */}
      <View style={styles.locationTextContainer}>
        {/* "Chosen Location" Label */}
        <Text color='#6B7280' style={styles.locationLabel}>
          Chosen Location
        </Text>

        {/* Location Name - Pre-formatted from selector ✅ */}
        <Text numberOfLines={1} ellipsizeMode='tail' color='#1F2937' style={styles.locationText}>
          {formattedLocationDisplay}
        </Text>
      </View>

      {/* Dropdown Chevron */}
      <Icon name='chevron-down' family='Ionicons' size={20} color={theme.colors.onSurface} />
    </Pressable>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  locationHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#005250',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  locationLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
});
