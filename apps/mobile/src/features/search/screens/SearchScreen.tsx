/**
 * Search Screen
 *
 * Google Maps-like search experience for discovering offers.
 * Features:
 * - Unified dropdown: app establishments + Google Places results
 * - Offers load on place selection (not live as-you-type)
 * - Bottom sheet shows offers for selected place
 * - Toggle between Map and List views
 * - Semi-transparent radius circle
 * - Session token optimization for Google billing
 */

import { FlashList } from '@shopify/flash-list';
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { environment } from '@/config/environment';
import { Text, Input, Icon } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import {
  useNearbyOffers,
  useMapEstablishments,
  type ProximitySearchResult,
  type NearbyOffer,
  type MapEstablishment,
} from '@/features/offers/hooks';
import { useAppDispatch } from '@/hooks/redux';
import { useLocation } from '@/hooks/useLocation';
import { reverseGeocodeAsync } from '@/store/slices/locationSlice';
import { Logger } from '@/utils/logger';

import {
  LocationFilterModal,
  MapListToggle,
  PlaceOffersBottomSheet,
  EstablishmentMarker,
  EstablishmentBottomSheet,
  EstablishmentOfferRow,
  SearchResultsDropdown,
  type ViewMode,
} from '../components';
import { usePrefetchOffer } from '@/features/offers/hooks/useOffers';
import { useSearchPlaceSelection } from '../hooks/useSearchPlaceSelection';
import { useSearchMapCamera } from '../hooks/useSearchMapCamera';
import {
  NO_OFFERS,
  groupOffersByEstablishment,
  type EstablishmentGroup,
} from '../utils/groupOffers';
import { regionFor } from '../utils/mapRegion';

import type { SearchScreenNavigationProp } from '@/navigation/types';

// ============================================================================
// Constants
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fallback map center from environment config (only used when user has no location set)
const DEFAULT_LOCATION = {
  latitude: environment.geolocation.defaultLatitude,
  longitude: environment.geolocation.defaultLongitude,
};

/**
 * Frozen empty fallback for the marker list. `?? []` allocates a fresh array on
 * every render while the query is loading, which re-keys the markers and
 * invalidates anything memoising on it. Same reasoning as NO_OFFERS.
 */
const NO_ESTABLISHMENTS: ProximitySearchResult<MapEstablishment>[] = [];

const INITIAL_RADIUS_KM = 15;
const TRANSPARENT = 'transparent';
const MAP_LOADING_OVERLAY = 'rgba(255, 255, 255, 0.7)';
const SURFACE_SHADOW = '#000';

// ============================================================================
// Types
// ============================================================================

interface SearchScreenProps {
  navigation: SearchScreenNavigationProp;
}

// ============================================================================
// Component
// ============================================================================

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const dispatch = useAppDispatch();
  const prefetchOffer = usePrefetchOffer();

  // Location hook
  const {
    coordinates: userCoordinates,
    preferredRadiusKm,
    setRadius,
    requestLocation,
    setManualLocationValue,
    isLoading: isLocationLoading,
    hasLocation,
  } = useLocation();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] =
    useState<ProximitySearchResult<MapEstablishment> | null>(null);

  // Use user location or default to Sousse
  const centerCoordinates = useMemo(() => {
    if (hasLocation && userCoordinates) {
      return userCoordinates;
    }
    return DEFAULT_LOCATION;
  }, [hasLocation, userCoordinates]);

  // Search radius (use preferredRadiusKm or default)
  const searchRadius = preferredRadiusKm ?? INITIAL_RADIUS_KM;
  const searchRadiusMeters = searchRadius * 1000;

  // ─────────────────────────────────────────────────────────────────────────
  // Unified Place Search (Google Places + App Establishments)
  // ─────────────────────────────────────────────────────────────────────────

  // Stable identities: these feed memoised children and hook dependency arrays,
  // so an inline arrow here would recreate the whole handler chain every render.
  const clearSelectedEstablishment = useCallback(() => setSelectedEstablishment(null), []);
  const closeLocationModal = useCallback(() => setShowLocationModal(false), []);

  // Camera first: it needs only the radius, so it can be created before the
  // selected place exists. See the note in useSearchMapCamera.
  const {
    mapRef,
    isReady: mapReady,
    error: mapError,
    setError: setMapError,
    animateTo,
    handleMapReady,
  } = useSearchMapCamera(searchRadius);

  const {
    searchQuery,
    showPlaceResults,
    selectedPlace,
    googleResults,
    appResults,
    isSearching: isSearchingPlaces,
    debouncedQuery,
    handleSearchChange,
    handleClearSearch,
    handleSearchFocus,
    handleSearchBlur,
    handleGooglePlacePress,
    handleAppEstablishmentSelect,
    closePlaceSheet,
  } = useSearchPlaceSelection({
    center: centerCoordinates,
    radiusMeters: searchRadiusMeters,
    animateTo,
    setManualLocationValue,
    // A newly chosen place supersedes whichever marker was open.
    onPlaceSelected: clearSelectedEstablishment,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Offer fetching: loads around current center OR selected place
  // ─────────────────────────────────────────────────────────────────────────

  const offerCenter = selectedPlace?.coordinates ?? centerCoordinates;

  const mapRegion = useMemo(
    () => regionFor(offerCenter, searchRadius),
    [offerCenter, searchRadius],
  );

  const searchParams = useMemo(
    () => ({
      center: offerCenter,
      radius: searchRadiusMeters,
      limit: 50,
      sortByDistance: true,
      ...(viewMode === 'list' && debouncedQuery.length >= 2 ? { query: debouncedQuery } : {}),
    }),
    [offerCenter, searchRadiusMeters, viewMode, debouncedQuery],
  );

  const {
    data: offers,
    isLoading: isLoadingOffers,
    refetch,
    isRefetching,
  } = useNearbyOffers(searchParams);

  // Map establishments (with embedded offers) for map markers
  const { data: mapEstablishments } = useMapEstablishments(searchParams);
  // Frozen fallback rather than an inline empty array — see NO_ESTABLISHMENTS.
  const displayEstablishments = mapEstablishments ?? NO_ESTABLISHMENTS;

  // Offers to display (no client-side text filter — offers load for selected place)
  const displayOffers = offers ?? NO_OFFERS;

  // FlashList types contentContainerStyle as a single object, so this cannot be
  // composed from a StyleSheet entry — memoizing keeps the identity stable.
  const listContentStyle = useMemo(
    () => ({ paddingHorizontal: 16, paddingBottom: 24, paddingTop: insets.top + 120 }),
    [insets.top],
  );

  const groupedEstablishments = useMemo(
    () => groupOffersByEstablishment(displayOffers),
    [displayOffers],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Every route to an offer goes through here: the place sheet, the
   * establishment sheet, and the list rows all did this identically.
   */
  const openOffer = useCallback(
    (offerId: string) => {
      prefetchOffer(offerId);
      navigation.navigate('OfferDetails', { offerId });
    },
    [navigation, prefetchOffer],
  );

  const handleLocationPress = useCallback(() => {
    setShowLocationModal(true);
  }, []);

  const clearMapError = useCallback(() => setMapError(null), [setMapError]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleRadiusChange = useCallback(
    (radius: number) => {
      setRadius(radius);
      animateTo(offerCenter, { radiusKm: radius, durationMs: 300 });
    },
    [setRadius, offerCenter, animateTo],
  );

  const handleLocationSelect = useCallback(
    (location: { coordinates: { latitude: number; longitude: number }; name: string }) => {
      setManualLocationValue(location.coordinates, location.name);
      closePlaceSheet();
      animateTo(location.coordinates);
    },
    [setManualLocationValue, animateTo, closePlaceSheet],
  );

  const handleUseMyLocation = useCallback(async () => {
    try {
      const result = await requestLocation();

      if (!result.success || !result.coordinates) {
        return;
      }

      closePlaceSheet();

      animateTo(result.coordinates);

      Logger.debug(
        '[SearchScreen] GPS acquired, triggering reverse geocoding for header update...',
      );
      void dispatch(reverseGeocodeAsync(result.coordinates))
        .unwrap()
        .then(() => {
          Logger.info('[SearchScreen] Reverse geocoding completed - HomeScreen header updated');
        })
        .catch((error: unknown) => {
          Logger.warn('[SearchScreen] Reverse geocoding failed, header will show fallback', {
            error: String(error),
          });
        });
    } catch (error) {
      Logger.error('[SearchScreen] Failed to get current location:', {}, error as Error);
    }
  }, [requestLocation, animateTo, dispatch, closePlaceSheet]);

  const handleUseMyLocationPress = useCallback(() => {
    void handleUseMyLocation();
  }, [handleUseMyLocation]);

  const searchOverlayStyle = {
    paddingTop: insets.top + 8,
    backgroundColor: viewMode === 'map' ? TRANSPARENT : theme.colors.background,
  };

  const handleEstablishmentMarkerPress = useCallback(
    (est: ProximitySearchResult<MapEstablishment>) => {
      setSelectedEstablishment(est);
      animateTo(est.geoData.coordinates, { zoom: 0.5, durationMs: 300 });
    },
    [animateTo],
  );

  const handleOfferPress = useCallback(
    (offer: ProximitySearchResult<NearbyOffer>) => openOffer(offer.item._id),
    [openOffer],
  );

  const handleMapPress = useCallback((event?: { nativeEvent?: { action?: string } }) => {
    // On Android, MapView.onPress fires for marker taps too.
    // Only clear selection when the background map itself is tapped.
    if (event?.nativeEvent?.action === 'marker-press') return;
    setSelectedEstablishment(null);
  }, []);

  const handleRecenter = useCallback(
    () => animateTo(offerCenter, { durationMs: 300 }),
    [animateTo, offerCenter],
  );

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setSelectedEstablishment(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render Functions
  // ─────────────────────────────────────────────────────────────────────────

  const renderEstablishmentRow = useCallback(
    ({ item }: { item: EstablishmentGroup }) => (
      <EstablishmentOfferRow group={item} onOfferPress={handleOfferPress} />
    ),
    [handleOfferPress],
  );

  const renderListEmpty = useCallback(() => {
    if (isLoadingOffers) {
      return (
        <View style={styles.emptyContainer}>
          <SkeletonOfferCard imageAspectRatio={1.4} style={styles.skeletonCardMargin} />
          <SkeletonOfferCard imageAspectRatio={1.4} style={styles.skeletonCardMargin} />
          <SkeletonOfferCard imageAspectRatio={1.4} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon name='search' family='Ionicons' size={48} color={theme.colors.onSurfaceVariant} />
        </View>
        <Text variant='title' size='lg' weight='semibold' align='center' style={styles.emptyTitle}>
          No offers found
        </Text>
        <Text variant='body' size='md' color='secondary' align='center' style={styles.emptyText}>
          Try expanding your search radius or search for a place.
        </Text>
      </View>
    );
  }, [isLoadingOffers, theme.colors]);

  const renderListHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        <Text variant='title' size='md' weight='semibold'>
          {groupedEstablishments.length}{' '}
          {groupedEstablishments.length === 1 ? 'business' : 'businesses'} nearby
        </Text>
        <Text variant='body' size='sm' color='secondary'>
          Within {searchRadius} km
          {selectedPlace ? ` of ${selectedPlace.name}` : ''}
        </Text>
      </View>
    ),
    [groupedEstablishments.length, searchRadius, selectedPlace],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Map View */}
      {viewMode === 'map' && (
        <View style={styles.mapContainer}>
          {mapError != null ? (
            <View
              style={[styles.mapErrorContainer, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              <Icon
                name='map-outline'
                family='Ionicons'
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant='title'
                size='md'
                weight='semibold'
                align='center'
                style={styles.mapErrorTitle}
              >
                {t('search.mapUnavailable')}
              </Text>
              <Text variant='body' size='sm' color='secondary' align='center'>
                {t('search.mapUnavailableDescription')}
              </Text>
              <Pressable
                style={[styles.mapRetryButton, { backgroundColor: theme.colors.primary }]}
                onPress={clearMapError}
                accessibilityRole='button'
                accessibilityLabel={t('search.a11yRetryMap')}
                accessibilityHint={t('search.a11yRetryMapHint')}
              >
                <Text
                  variant='label'
                  size='sm'
                  weight='semibold'
                  style={{ color: theme.colors.onPrimary }}
                >
                  {t('search.retry')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={mapRegion}
                showsUserLocation={hasLocation}
                showsMyLocationButton={false}
                showsCompass={false}
                onPress={handleMapPress}
                onMapReady={handleMapReady}
                accessibilityLabel={t('search.a11yMapView')}
                accessibilityHint={t('search.a11yMapViewHint')}
              >
                {/* Search radius circle */}
                <Circle
                  center={offerCenter}
                  radius={searchRadiusMeters}
                  strokeColor={theme.colors.primary}
                  strokeWidth={2}
                  fillColor={`${theme.colors.primary}40`}
                />

                {/* Establishment markers — one per establishment */}
                {mapReady &&
                  displayEstablishments.map(est => (
                    <EstablishmentMarker
                      key={est.item._id}
                      establishment={est}
                      isSelected={selectedEstablishment?.item._id === est.item._id}
                      onPress={() => handleEstablishmentMarkerPress(est)}
                    />
                  ))}
              </MapView>

              {/* Recenter button */}
              <Pressable
                style={[
                  styles.recenterButton,
                  {
                    backgroundColor: theme.colors.background,
                    top: SCREEN_HEIGHT * 0.4,
                  },
                ]}
                onPress={handleRecenter}
                accessibilityRole='button'
                accessibilityLabel={t('search.a11yRecenterMap')}
                accessibilityHint={t('search.a11yRecenterMapHint')}
              >
                <Icon name='locate' family='Ionicons' size={22} color={theme.colors.primary} />
              </Pressable>

              {/* Loading overlay */}
              {/* Full overlay only on first load; a small indicator handles re-fetches */}
              {isLoadingOffers && displayOffers.length === 0 && (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size='large' color={theme.colors.primary} />
                </View>
              )}
              {(isLoadingOffers || isRefetching) && displayOffers.length > 0 && (
                <View style={styles.mapRefetchIndicator} pointerEvents='none'>
                  <ActivityIndicator size='small' color={theme.colors.primary} />
                </View>
              )}

              {/* Establishment bottom sheet (marker tap) */}
              {!selectedPlace && (
                <EstablishmentBottomSheet
                  visible={!!selectedEstablishment}
                  establishment={selectedEstablishment}
                  onClose={clearSelectedEstablishment}
                  onOfferPress={openOffer}
                  bottomInset={0}
                />
              )}

              {/* Place Offers Bottom Sheet (place selected from dropdown) */}
              <PlaceOffersBottomSheet
                visible={!!selectedPlace}
                placeName={selectedPlace?.name ?? ''}
                placeAddress={selectedPlace?.address ?? ''}
                offers={displayOffers}
                isLoading={isLoadingOffers}
                onClose={closePlaceSheet}
                onOfferPress={openOffer}
              />
            </>
          )}
        </View>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <FlashList
          data={groupedEstablishments}
          keyExtractor={item => item.establishmentId}
          renderItem={renderEstablishmentRow}
          estimatedItemSize={320}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderListEmpty}
          contentContainerStyle={listContentStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              progressViewOffset={insets.top + 120}
            />
          }
        />
      )}

      {/* Search Bar Overlay */}
      <View pointerEvents='box-none' style={[styles.searchOverlay, searchOverlayStyle]}>
        {/* Search Row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background }]}>
            <Input
              placeholder={t('search.searchBusinessesPlaces')}
              value={searchQuery}
              onChangeText={handleSearchChange}
              leftIcon='search-outline'
              leftIconFamily='Ionicons'
              rightIcon={searchQuery ? 'close-circle' : undefined}
              rightIconFamily='Ionicons'
              onRightIconPress={handleClearSearch}
              returnKeyType='search'
              autoCorrect={false}
              style={styles.searchInput}
              containerStyle={styles.searchInputInner}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
          </View>

          {/* Location Button */}
          <Pressable
            style={[styles.locationButton, { backgroundColor: theme.colors.background }]}
            onPress={handleLocationPress}
            accessibilityLabel={t('search.a11yLocationSettings')}
            accessibilityHint={t('search.a11yLocationSettingsHint')}
          >
            <Icon name='location-sharp' family='Ionicons' size={22} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Unified Dropdown: App Establishments + Google Places */}
        <SearchResultsDropdown
          visible={showPlaceResults}
          isSearching={isSearchingPlaces}
          query={debouncedQuery}
          appResults={appResults}
          googleResults={googleResults}
          onAppEstablishmentPress={handleAppEstablishmentSelect}
          onGooglePlacePress={handleGooglePlacePress}
        />

        {/* Toggle Row */}
        <View style={styles.toggleRow}>
          <MapListToggle value={viewMode} onChange={handleViewModeChange} />
        </View>
      </View>

      {/* Location Filter Modal */}
      <LocationFilterModal
        visible={showLocationModal}
        onClose={closeLocationModal}
        currentRadius={searchRadius}
        onRadiusChange={handleRadiusChange}
        onLocationSelect={handleLocationSelect}
        onUseMyLocation={handleUseMyLocationPress}
        isLoadingLocation={isLocationLoading}
      />
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MAP_LOADING_OVERLAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapRefetchIndicator: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    padding: 6,
    zIndex: 20,
  },
  mapErrorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  mapErrorTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  mapRetryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  recenterButton: {
    position: 'absolute',
    insetInlineEnd: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: SURFACE_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    borderRadius: 14,
    shadowColor: SURFACE_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  searchInputInner: {
    marginBottom: 0,
  },
  searchInput: {
    borderWidth: 0,
  },
  locationButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: SURFACE_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listHeader: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptyText: {
    marginTop: 8,
  },
  skeletonCardMargin: {
    marginBottom: 16,
  },
});
