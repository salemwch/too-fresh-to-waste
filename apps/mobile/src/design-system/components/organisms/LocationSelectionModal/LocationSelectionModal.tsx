/**
 * LocationSelectionModal
 *
 * First-time location setup modal shown after email verification.
 * Provides 2 options for setting user location:
 * 1. "Use my current location" - Request GPS location
 * 2. Search bar - Search by city name
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Modal,
  Platform,
  Pressable,
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

// ============================================================================
// Types
// ============================================================================

const MODAL_FADE_DURATION_MS = 300;

/**
 * Safety net for the `onShow` gate below. `onShow` is dispatched from the
 * Android Dialog's own OnShowListener so it is reliable, but a permanently
 * dead button would be a worse failure than the race it prevents — so the
 * options unlock anyway if the event never arrives. Deliberately far longer
 * than the fade so it never pre-empts the real signal.
 */
const APPEARANCE_FALLBACK_MS = 1_200;

interface LocationSelectionModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Callback when location is selected */
  onLocationSelect: (coordinates: { latitude: number; longitude: number }, name: string) => void;
  /** Whether location request is in progress */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Fires after the native Modal has fully dismissed (animation complete) */
  onDismissComplete?: () => void;
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
    onDismissComplete,
    testID = 'location-selection-modal',
  }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [showCitySearch, setShowCitySearch] = useState(false);
    const prevVisible = useRef(visible);

    /**
     * Whether the native Dialog window has finished appearing.
     *
     * On Android this Modal is a real `ComponentDialog` window with a fade
     * animation. Acting on a press while that enter animation is still running
     * queues the dialog's `dismiss()` behind it, so the window is still
     * attached when the caller starts the runtime-permission Activity — two
     * native windows fight and the task gets pushed to the background, which
     * the user experiences as the app closing.
     *
     * Gating on `onShow` (dispatched from the Dialog's own OnShowListener)
     * makes that state unreachable: the press cannot land until the window has
     * settled, so the dismiss that follows starts immediately.
     */
    const [hasAppeared, setHasAppeared] = useState(false);

    const handleShow = useCallback(() => setHasAppeared(true), []);

    useEffect(() => {
      if (!visible) {
        setHasAppeared(false);
        return undefined;
      }
      const fallback = setTimeout(() => setHasAppeared(true), APPEARANCE_FALLBACK_MS);
      return () => clearTimeout(fallback);
    }, [visible]);

    // Both options are inert until the window has settled. The window is
    // opaque for the whole fade, so this is invisible to anyone tapping at
    // human speed — it only rejects the presses that would break.
    const canInteract = hasAppeared && !isLoading;

    // Android: detect visible → hidden transition and fire callback after fade completes.
    // iOS: handled natively by Modal's onDismiss prop below.
    useEffect(() => {
      if (Platform.OS !== 'android') {
        prevVisible.current = visible;
        return undefined;
      }

      if (prevVisible.current && !visible) {
        const timer = setTimeout(() => {
          onDismissComplete?.();
        }, MODAL_FADE_DURATION_MS);
        prevVisible.current = visible;
        return () => clearTimeout(timer);
      }

      prevVisible.current = visible;
      return undefined;
    }, [visible, onDismissComplete]);

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
          onDismiss={Platform.OS === 'ios' ? onDismissComplete : undefined}
          onShow={handleShow}
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
                      disabled={!canInteract}
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
                      disabled={!canInteract}
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
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  errorText: {
    marginStart: 8,
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
  outlinedButton: {
    borderWidth: 1,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: 12,
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
    marginStart: 12,
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
