/**
 * LocationSelectionModal
 *
 * First-time location setup modal shown after email verification.
 * Provides 2 options for setting user location:
 * 1. "Use my current location" - Request GPS location
 * 2. Search bar - Search by city name
 */

import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import { ManualLocationModal } from '../ManualLocationModal';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

// ============================================================================
// Constants
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

interface LocationSelectionModalProps {
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

export const LocationSelectionModal = memo<LocationSelectionModalProps>(
  ({
    visible,
    onLocationSelect,
    isLoading = false,
    error = null,
    testID = 'location-selection-modal',
  }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [showCitySearch, setShowCitySearch] = useState(false);

    // No appearance gate and no dismiss-timing plumbing here on purpose.
    //
    // This component previously blocked presses until the native Dialog
    // reported `onShow`, and told the caller when its fade had finished, so the
    // caller could delay the runtime-permission request until the dialog window
    // was gone. All of that was written against a diagnosis that turned out to
    // be wrong: the app was not being pushed to the background by conflicting
    // windows, it was crashing. `locationSlice` fired two concurrent
    // `getCurrentPosition` calls, and Play Services throws
    // `NullPointerException: Listener must not be null` when the second
    // single-shot callback is delivered — proven from a release-70 logcat
    // deobfuscated through mapping.txt. The Modal was never involved.
    //
    // The gate also never did what it claimed: `Dialog.show()` posts its
    // OnShowListener to the looper, so `onShow` fires about one frame after the
    // window attaches, not after the 300 ms fade. It cost a briefly dead button
    // and three timing constants, and bought nothing.
    const dimOverlayStyle = { backgroundColor: theme.colors.overlay.dark };
    const modalContentStyle = {
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.onSurface,
    };
    const errorContainerStyle = { backgroundColor: theme.colors.errorContainer };
    const primaryOptionStyle = {
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.primary,
    };
    const secondaryOptionStyle = {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outline,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────────────

    const handleRequestGPSLocation = useCallback(() => {
      onLocationSelect({ latitude: 0, longitude: 0 }, 'gps');
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
          animationType='fade'
          statusBarTranslucent
          onRequestClose={() => {}}
          testID={testID}
        >
          {/* Dimmed Background Overlay */}
          <View style={styles.overlay}>
            <View style={[styles.dimOverlay, dimOverlayStyle]} />

            {/* Modal Content */}
            <View style={styles.modalContainer}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.modalContent, modalContentStyle]}>
                  {/* Header */}
                  <View style={styles.header}>
                    <Icon name='location' size={48} color={theme.colors.primary} />
                    <Text
                      variant='headline'
                      size='lg'
                      weight='bold'
                      align='center'
                      style={styles.headerTitle}
                    >
                      Where should we look for food?
                    </Text>
                    <Text variant='body' size='md' color='secondary' align='center'>
                      Help us find the best deals near you
                    </Text>
                  </View>

                  {/* Error Message */}
                  {error && (
                    <View style={[styles.errorContainer, errorContainerStyle]}>
                      <Icon name='alert-circle' size={20} color={theme.colors.error} />
                      <Text variant='body' size='sm' color='error' style={styles.errorText}>
                        {error}
                      </Text>
                    </View>
                  )}

                  {/* Options */}
                  <View style={styles.optionsContainer}>
                    {/* Use my current location */}
                    <Pressable
                      style={[styles.optionButton, styles.outlinedButton, primaryOptionStyle]}
                      onPress={handleRequestGPSLocation}
                      testID={`${testID}-gps-option`}
                      disabled={isLoading}
                      accessibilityRole='button'
                      accessibilityLabel={t('location.a11yUseMyLocation')}
                      accessibilityHint={t('location.a11yUseMyLocationHint')}
                    >
                      <View style={styles.optionIconContainer}>
                        <Icon name='navigate' size={24} color={theme.colors.primary} />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text variant='body' size='md' weight='semibold'>
                          {t('location.a11yUseMyLocation')}
                        </Text>
                        <Text variant='body' size='sm' color='secondary'>
                          Find the best deals near you
                        </Text>
                      </View>
                      <Icon name='chevron-forward' size={20} color={theme.colors.secondary} />
                    </Pressable>

                    {/* Divider */}
                    <View style={styles.dividerContainer}>
                      <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                      <Text variant='body' size='sm' color='secondary' style={styles.dividerText}>
                        OR
                      </Text>
                      <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                    </View>

                    {/* Option 4: Search by city */}
                    <Pressable
                      style={[styles.searchButton, styles.outlinedButton, secondaryOptionStyle]}
                      onPress={handleSearchCityPress}
                      testID={`${testID}-city-option`}
                      disabled={isLoading}
                      accessibilityRole='button'
                      accessibilityLabel={t('location.a11ySearchCity')}
                      accessibilityHint={t('location.a11ySearchCityHint')}
                    >
                      <Icon name='search' size={20} color={theme.colors.secondary} />
                      <Text
                        variant='body'
                        size='md'
                        color='secondary'
                        style={styles.searchPlaceholder}
                      >
                        Search by city or area...
                      </Text>
                    </Pressable>
                  </View>

                  {/* Loading Indicator */}
                  {isLoading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size='large' color={theme.colors.primary} />
                      <Text variant='body' size='sm' color='secondary' style={styles.loadingText}>
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
          testID='city-search-modal'
        />
      </>
    );
  },
);

LocationSelectionModal.displayName = 'LocationSelectionModal';

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
    borderRadius: 24,
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
    padding: sp[3],
    marginBottom: 16,
    borderRadius: 8,
  },
  errorText: {
    marginStart: 8,
    flex: 1,
  },
  optionsContainer: {
    gap: sp[3],
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  outlinedButton: {
    borderWidth: 1,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: sp[3],
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
    marginHorizontal: sp[3],
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  searchPlaceholder: {
    marginStart: sp[3],
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: sp[5],
  },
  loadingText: {
    marginTop: sp[3],
  },
});
