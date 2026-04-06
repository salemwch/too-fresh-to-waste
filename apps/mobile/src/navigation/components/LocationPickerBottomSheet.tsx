/**
 * LocationPickerBottomSheet Component
 * Bottom sheet for selecting location (GPS or manual search)
 *
 * Features:
 * - Search for city/area
 * - Use current GPS location
 * - Recent locations history
 * - Theme-aware styling (no hardcoded colors)
 * - Responsive layout
 * - Smooth animated backdrop (like OfferDetailsScreen)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Keyboard,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

// ============================================================================
// Types
// ============================================================================

export interface LocationItem {
  id: string;
  name: string; // â† Kept for backward compatibility (used as fallback)
  city?: string; // â† Primary: City name for bold display
  fullAddress?: string; // â† Secondary: Full context for gray text
  latitude?: number;
  longitude?: number;
  /** Google Place ID for deferred detail fetching (GOOGLE sources only) */
  googlePlaceId?: string;
}

interface LocationPickerBottomSheetProps {
  /** Bottom sheet visibility */
  visible: boolean;
  /** Current location name */
  currentLocation: string | null;
  /** Recent locations list */
  recentLocations?: LocationItem[];
  /** Search results from location search hook */
  searchResults?: LocationItem[];
  /** Current search query */
  searchQuery?: string;
  /** Loading state for GPS */
  isLoadingGPS?: boolean;
  /** Loading state for search */
  isSearching?: boolean;
  /** Close handler */
  onClose: () => void;
  /** Use current GPS location */
  onUseCurrentLocation: () => void;
  /** Select a location from search or recent */
  onSelectLocation: (location: LocationItem) => void;
  /** Search query change */
  onSearchChange?: (query: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const LocationPickerBottomSheet: React.FC<LocationPickerBottomSheetProps> = ({
  visible,
  currentLocation,
  recentLocations = [],
  searchResults = [],
  searchQuery = '',
  isLoadingGPS = false,
  isSearching = false,
  onClose,
  onUseCurrentLocation,
  onSelectLocation,
  onSearchChange,
}) => {
  const theme = useTheme();

  // ============================================================================
  // Animations (Same as OfferDetailsScreen)
  // ============================================================================

  const [slideAnim] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const backdropStyle = {
    backgroundColor: theme.colors.overlay.darker,
    opacity: fadeAnim,
  };
  const containerStyle = {
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.neutral[1000],
    transform: [{ translateY: slideAnim }],
  };
  const selectedRecentItemStyle = {
    backgroundColor: theme.colors.primaryContainer,
  };

  useEffect(() => {
    if (visible) {
      // âœ… Smooth parallel animation (backdrop fade + sheet slide)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth ease-out
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          easing: Easing.bezier(0.42, 0, 0.58, 1), // Smooth ease-in-out
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearchChange = useCallback(
    (text: string) => {
      onSearchChange?.(text);
    },
    [onSearchChange],
  );

  const handleUseCurrentLocation = useCallback(() => {
    Keyboard.dismiss();
    onUseCurrentLocation();
  }, [onUseCurrentLocation]);

  const handleSelectLocation = useCallback(
    (location: LocationItem) => {
      Keyboard.dismiss();
      // Note: Parent will clear search query via onSearchChange
      onSelectLocation(location);
    },
    [onSelectLocation],
  );

  const getPrimaryLocationLabel = useCallback(
    (location: LocationItem) => location.city ?? location.name?.split(',')[0] ?? 'Location',
    [],
  );

  const getSecondaryLocationLabel = useCallback(
    (location: LocationItem) => location.fullAddress ?? location.name,
    [],
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();

    // âœ… Animate out before closing
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        easing: Easing.bezier(0.42, 0, 0.58, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [onClose, fadeAnim, slideAnim]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType='none'
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Animated Backdrop - Fades in smoothly */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </TouchableWithoutFeedback>

        {/* Animated Bottom Sheet Container - Slides up smoothly */}
        <Animated.View style={[styles.container, containerStyle]}>
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: theme.colors.outlineVariant }]} />
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
          >
            {/* Search Input */}
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outline,
                },
              ]}
            >
              <Icon
                name='search'
                family='Ionicons'
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder='Search city or area...'
                placeholderTextColor={theme.colors.onSurfaceVariant}
                style={[styles.searchInput, { color: theme.colors.onSurface }]}
                returnKeyType='search'
                autoCapitalize='words'
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => onSearchChange?.('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon
                    name='close-circle'
                    family='Ionicons'
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
              )}
            </View>

            {/* Use Current Location Button */}
            <Pressable
              style={[
                styles.locationButton,
                {
                  backgroundColor: theme.colors.primaryContainer,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={handleUseCurrentLocation}
              disabled={isLoadingGPS}
              accessibilityLabel='Use current GPS location'
              accessibilityRole='button'
            >
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              >
                <Icon
                  name={isLoadingGPS ? 'hourglass-outline' : 'locate'}
                  family='Ionicons'
                  size={20}
                  color={theme.colors.onPrimary}
                />
              </View>
              <Text
                style={[
                  styles.locationText,
                  {
                    color: theme.colors.onPrimaryContainer,
                    fontWeight: theme.typography.fontWeight?.semibold ?? '600',
                  },
                ]}
              >
                {isLoadingGPS ? 'Getting location...' : 'Use current location'}
              </Text>
            </Pressable>

            {/* ðŸ†• Search Results Section */}
            {searchQuery.length > 0 && (
              <View style={styles.recentSection}>
                <Text
                  style={[
                    styles.sectionHeader,
                    {
                      color: theme.colors.onSurfaceVariant,
                      fontWeight: theme.typography.fontWeight?.semibold ?? '600',
                    },
                  ]}
                >
                  {isSearching ? 'SEARCHING...' : 'SEARCH RESULTS'}
                </Text>

                {isSearching ? (
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    Searching for locations...
                  </Text>
                ) : searchResults !== undefined && searchResults.length > 0 ? (
                  searchResults.map(location => (
                    <Pressable
                      key={location.id}
                      style={
                        currentLocation === location.name
                          ? [styles.recentItem, selectedRecentItemStyle]
                          : styles.recentItem
                      }
                      onPress={() => handleSelectLocation(location)}
                    >
                      <View style={styles.recentItemContent}>
                        <View
                          style={[
                            styles.locationIconWrapper,
                            { backgroundColor: theme.colors.secondaryContainer },
                          ]}
                        >
                          <Icon
                            name='location-sharp'
                            family='Ionicons'
                            size={16}
                            color={theme.colors.onSecondaryContainer}
                          />
                        </View>
                        <View style={styles.searchResultTextContainer}>
                          {/* Primary: City name (BOLD) */}
                          <Text
                            style={[
                              styles.searchResultPrimaryText,
                              {
                                color:
                                  currentLocation === location.name
                                    ? theme.colors.onPrimaryContainer
                                    : theme.colors.onSurface,
                                fontWeight: theme.typography.fontWeight?.semibold ?? '600',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {getPrimaryLocationLabel(location)}
                          </Text>
                          {/* Secondary: Full address context (GRAY) */}
                          <Text
                            style={[
                              styles.searchResultSecondaryText,
                              {
                                color:
                                  currentLocation === location.name
                                    ? theme.colors.onPrimaryContainer
                                    : theme.colors.onSurfaceVariant,
                                fontWeight: theme.typography.fontWeight?.regular ?? '400',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {getSecondaryLocationLabel(location)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    {`No locations found for "${searchQuery}"`}
                  </Text>
                )}
              </View>
            )}

            {/* Recent Locations Section */}
            {recentLocations.length > 0 && searchQuery.length === 0 && (
              <View style={styles.recentSection}>
                <Text
                  style={[
                    styles.sectionHeader,
                    {
                      color: theme.colors.onSurfaceVariant,
                      fontWeight: theme.typography.fontWeight?.semibold ?? '600',
                    },
                  ]}
                >
                  RECENT LOCATIONS
                </Text>

                {recentLocations.map(location => (
                  <Pressable
                    key={location.id}
                    style={
                      currentLocation === location.name
                        ? [styles.recentItem, selectedRecentItemStyle]
                        : styles.recentItem
                    }
                    onPress={() => handleSelectLocation(location)}
                    accessibilityLabel={`Select ${location.name}`}
                    accessibilityRole='button'
                  >
                    <View
                      style={[styles.iconCircle, { backgroundColor: theme.colors.surfaceVariant }]}
                    >
                      <Icon
                        name='time-outline'
                        family='Ionicons'
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </View>
                    <View style={styles.searchResultTextContainer}>
                      {/* Primary: City name (BOLD) */}
                      <Text
                        style={[
                          styles.searchResultPrimaryText,
                          {
                            color:
                              currentLocation === location.name
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.onSurface,
                            fontWeight: theme.typography.fontWeight?.semibold ?? '600',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {getPrimaryLocationLabel(location)}
                      </Text>
                      {/* Secondary: Full address context (GRAY) */}
                      <Text
                        style={[
                          styles.searchResultSecondaryText,
                          {
                            color:
                              currentLocation === location.name
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.onSurfaceVariant,
                            fontWeight: theme.typography.fontWeight?.regular ?? '400',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {getSecondaryLocationLabel(location)}
                      </Text>
                    </View>
                    {currentLocation === location.name && (
                      <Icon
                        name='checkmark-circle'
                        family='Ionicons'
                        size={20}
                        color={theme.colors.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Empty State - No Recent Locations */}
            {recentLocations.length === 0 && (
              <View style={styles.emptyState}>
                <Icon
                  name='location-outline'
                  family='Ionicons'
                  size={48}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: theme.colors.onSurfaceVariant,
                      marginTop: theme.spacing.base.md,
                    },
                  ]}
                >
                  No recent locations
                </Text>
                <Text
                  style={[
                    styles.emptySubtext,
                    {
                      color: theme.colors.onSurfaceVariant,
                      marginTop: theme.spacing.base.xs,
                    },
                  ]}
                >
                  Search for a location or use your current location
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    minHeight: '60%', // âœ… Ensures visible content
    maxHeight: '80%',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 48,
    height: 6,
    borderRadius: 999,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 16,
    flex: 1,
  },
  recentSection: {
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    gap: 16,
  },
  recentItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  locationIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultTextContainer: {
    flex: 1,
    gap: 2,
  },
  searchResultPrimaryText: {
    fontSize: 16,
    lineHeight: 20,
  },
  searchResultSecondaryText: {
    fontSize: 14,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
