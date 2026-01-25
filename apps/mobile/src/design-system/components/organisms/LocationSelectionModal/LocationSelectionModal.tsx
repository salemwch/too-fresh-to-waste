/**
 * LocationSelectionModal
 *
 * First-time location setup modal shown after email verification.
 * Provides 4 options for setting user location:
 * 1. "Delicious food near me" - Request GPS location
 * 2. "Use my current location" - Request GPS location
 * 3. "Use default location" - Use Sousse city center
 * 4. Search bar - Search by city name
 *
 * Features:
 * - Blurred/dimmed background overlay
 * - Centered modal with options
 * - Location permission handling
 * - Manual city search fallback
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { ManualLocationModal } from '../ManualLocationModal';

// ============================================================================
// Constants
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Sousse City Center coordinates (from SearchScreen.tsx)
const SOUSSE_CENTER = {
  latitude: 35.8288,
  longitude: 10.6405,
  name: 'Sousse, Tunisia',
};

// ============================================================================
// Types
// ============================================================================

export interface LocationSelectionModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Callback when location is selected */
  onLocationSelect: (coordinates: { latitude: number; longitude: number }, name: string) => void;
  /** Whether location request is in progress */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// Component
// ============================================================================

export const LocationSelectionModal: React.FC<LocationSelectionModalProps> = ({
  visible,
  onLocationSelect,
  isLoading = false,
  error = null,
  testID = 'location-selection-modal',
}) => {
  const theme = useTheme();
  const [showCitySearch, setShowCitySearch] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handle "Delicious food near me" / "Use my current location"
   * Both options request GPS location
   */
  const handleRequestGPSLocation = useCallback(() => {
    // Parent component (HomeScreen) will handle actual GPS request
    onLocationSelect({ latitude: 0, longitude: 0 }, 'gps'); // Signal to request GPS
  }, [onLocationSelect]);

  /**
   * Handle "Use default location"
   * Sets location to Sousse city center
   */
  const handleUseDefaultLocation = useCallback(() => {
    onLocationSelect(
      { latitude: SOUSSE_CENTER.latitude, longitude: SOUSSE_CENTER.longitude },
      SOUSSE_CENTER.name,
    );
  }, [onLocationSelect]);

  /**
   * Handle city search option
   */
  const handleSearchCityPress = useCallback(() => {
    setShowCitySearch(true);
  }, []);

  /**
   * Handle city selection from ManualLocationModal
   */
  const handleCitySelect = useCallback(
    (location: { coordinates: { latitude: number; longitude: number }; name: string }) => {
      setShowCitySearch(false);
      onLocationSelect(location.coordinates, location.name);
    },
    [onLocationSelect],
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
        testID={testID}
      >
        {/* Dimmed Background Overlay */}
        <View style={styles.overlay}>
          <View style={[styles.dimOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]} />

          {/* Modal Content */}
          <View style={styles.modalContainer}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: 24,
                    shadowColor: theme.colors.onSurface,
                  },
                ]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <Icon name="map-pin" size={48} color={theme.colors.primary} />
                  <Text
                    variant="headline"
                    size="lg"
                    weight="bold"
                    align="center"
                    style={styles.headerTitle}
                  >
                    Where should we look for food?
                  </Text>
                  <Text variant="body" size="md" color="secondary" align="center">
                    Help us find the best deals near you
                  </Text>
                </View>

                {/* Error Message */}
                {error && (
                  <View
                    style={[
                      styles.errorContainer,
                      { backgroundColor: theme.colors.errorContainer, borderRadius: 8 },
                    ]}
                  >
                    <Icon name="alert-circle" size={20} color={theme.colors.error} />
                    <Text
                      variant="body"
                      size="sm"
                      color="error"
                      style={styles.errorText}
                    >
                      {error}
                    </Text>
                  </View>
                )}

                {/* Options */}
                <View style={styles.optionsContainer}>
                  {/* Option 1: Delicious food near me */}
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: theme.colors.primaryContainer,
                        borderColor: theme.colors.primary,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={handleRequestGPSLocation}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Find delicious food near me"
                    accessibilityHint="Uses your current GPS location"
                  >
                    <View style={styles.optionIconContainer}>
                      <Icon name="search" size={24} color={theme.colors.primary} />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text variant="body" size="md" weight="semibold">
                        Delicious food near me
                      </Text>
                      <Text variant="body" size="sm" color="secondary">
                        Find nearby deals using GPS
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={theme.colors.secondary} />
                  </TouchableOpacity>

                  {/* Option 2: Use my current location */}
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outline,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={handleRequestGPSLocation}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Use my current location"
                    accessibilityHint="Request GPS location permission"
                  >
                    <View style={styles.optionIconContainer}>
                      <Icon name="navigation" size={24} color={theme.colors.primary} />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text variant="body" size="md" weight="semibold">
                        Use my current location
                      </Text>
                      <Text variant="body" size="sm" color="secondary">
                        We'll request permission
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={theme.colors.secondary} />
                  </TouchableOpacity>

                  {/* Option 3: Use default location (Sousse) */}
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outline,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={handleUseDefaultLocation}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Use default location in Sousse"
                    accessibilityHint="Sets location to Sousse city center"
                  >
                    <View style={styles.optionIconContainer}>
                      <Icon name="home" size={24} color={theme.colors.primary} />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text variant="body" size="md" weight="semibold">
                        Use default location
                      </Text>
                      <Text variant="body" size="sm" color="secondary">
                        Sousse city center
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={theme.colors.secondary} />
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={styles.dividerContainer}>
                    <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                    <Text variant="body" size="sm" color="secondary" style={styles.dividerText}>
                      OR
                    </Text>
                    <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                  </View>

                  {/* Option 4: Search by city */}
                  <TouchableOpacity
                    style={[
                      styles.searchButton,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outline,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={handleSearchCityPress}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Search for a city"
                    accessibilityHint="Opens city search modal"
                  >
                    <Icon name="search" size={20} color={theme.colors.secondary} />
                    <Text
                      variant="body"
                      size="md"
                      color="secondary"
                      style={styles.searchPlaceholder}
                    >
                      Search by city or area...
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Loading Indicator */}
                {isLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text
                      variant="body"
                      size="sm"
                      color="secondary"
                      style={styles.loadingText}
                    >
                      Getting your location...
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Location Modal (City Search) */}
      <ManualLocationModal
        visible={showCitySearch}
        onClose={() => setShowCitySearch(false)}
        onLocationSelect={handleCitySelect}
        testID="city-search-modal"
      />
    </>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 500,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  scrollContent: {
    flexGrow: 1,
  },
  modalContent: {
    padding: 24,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    flex: 1,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  searchPlaceholder: {
    marginLeft: 12,
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
  },
});
