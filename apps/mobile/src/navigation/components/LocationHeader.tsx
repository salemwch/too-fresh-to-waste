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
 * - Green circle (#1E4448) with location icon
 * - "Chosen Location" label
 * - Location name with ellipsis for overflow
 * - Chevron down indicator
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      accessibilityHint={t('location.a11yChangeLocationHint')}
      disabled={!onPress}
    >
      {/* Location Icon Circle - #1E4448 */}
      <View style={[styles.locationIconCircle, { backgroundColor: theme.colors.primary }]}>
        <Icon name='location' family='Ionicons' size={16} color={theme.colors.onPrimary} />
      </View>

      {/* Location Text Container */}
      <View style={styles.locationTextContainer}>
        {/* "Chosen Location" Label */}
        <Text color={theme.colors.onSurfaceVariant} style={styles.locationLabel}>
          Chosen Location
        </Text>

        {/* Location Name - Pre-formatted from selector ✅ */}
        <Text
          numberOfLines={1}
          ellipsizeMode='tail'
          color={theme.colors.onSurface}
          style={styles.locationText}
        >
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
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: 8,
  },
  locationTextContainer: {
    flex: 1,
    marginEnd: 8,
    justifyContent: 'center',
  },
  /*
   * No hardcoded `lineHeight` on either of these.
   *
   * `fontSize` is scaled by the OS accessibility setting; a literal
   * `lineHeight` is not. At a 2.0x system font scale these were 20px and 28px
   * of glyph inside 12px and 18px line boxes, so both lines were clipped.
   * Device-verified on 2026-08-30.
   *
   * Letting React Native derive the line height from the (already scaled) font
   * keeps the ratio correct at every scale. At 1.0x the derived values are
   * within a pixel of the literals they replace, so the header looks the same.
   */
  locationLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
