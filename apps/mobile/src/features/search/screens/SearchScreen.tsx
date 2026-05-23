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

import { Currency } from '@foodwaste/shared';
import { FlashList } from '@shopify/flash-list';
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Pressable,
} from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { environment } from '@/config/environment';
import { Text, Input, Icon } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { FavoriteOfferCard } from '@/features/favorites';
import {
  useNearbyOffers,
  useMapEstablishments,
  type ProximitySearchResult,
  type NearbyOffer,
  type NearbyEstablishment,
  type MapEstablishment,
} from '@/features/offers/hooks';
import { OfferType, CtaState, OfferStatus } from '@/features/offers/types/offer.types';
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
  type ViewMode,
} from '../components';
import { usePrefetchOffer } from '@/features/offers/hooks/useOffers';
import { usePlaceSearch } from '../hooks/usePlaceSearch';

import type { OfferListItem } from '@/features/offers/types/offer.types';
import type { SearchScreenNavigationProp } from '@/navigation/types';
import type { ILocationResult } from '@/types/location.types';
import type { Region } from 'react-native-maps';

// ============================================================================
// Constants
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fallback map center from environment config (only used when user has no location set)
const DEFAULT_LOCATION = {
  latitude: environment.geolocation.defaultLatitude,
  longitude: environment.geolocation.defaultLongitude,
};

const INITIAL_RADIUS_KM = 5;
const TRANSPARENT = 'transparent';
const MAP_LOADING_OVERLAY = 'rgba(255, 255, 255, 0.7)';
const SURFACE_SHADOW = '#000';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ProximitySearchResult<NearbyOffer> to OfferListItem
 */
const mapSearchResultToOfferListItem = (
  result: ProximitySearchResult<NearbyOffer>,
): OfferListItem => {
  const { item, distance } = result;

  let distanceInMeters = distance.value;
  if (distance.unit === 'kilometers') {
    distanceInMeters = distance.value * 1000;
  } else if (distance.unit === 'miles') {
    distanceInMeters = distance.value * 1609.34;
  }

  return {
    id: item._id,
    title: item.title,
    type: OfferType.SURPRISE_BAG,
    image: item.images?.[0] ?? undefined,
    pricing: {
      originalPrice: item.pricing.originalPrice,
      discountedPrice: item.pricing.discountedPrice,
      discountPercentage: item.pricing.discountPercentage,
      currency: (item.pricing.currency as Currency | null | undefined) ?? Currency.TND,
    },
    availableQuantity: item.availableQuantity,
    availableFrom: item.availableFrom,
    availableUntil: item.availableUntil,
    establishment: {
      name: item.establishmentName,
      ...(item.establishmentLogo ? { profileImage: item.establishmentLogo } : {}),
    },
    distance: distanceInMeters,
    ctaState:
      new Date() < new Date(item.availableFrom)
        ? CtaState.NOT_STARTED
        : item.availableQuantity > 0
          ? CtaState.AVAILABLE
          : CtaState.SOLD_OUT,
    status: OfferStatus.ACTIVE,
  };
};

// ============================================================================
// Types
// ============================================================================

interface SearchScreenProps {
  navigation: SearchScreenNavigationProp;
}

/** Selected place info used for bottom sheet + offer fetching */
interface SelectedPlace {
  name: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
}

// ============================================================================
// Component
// ============================================================================

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] =
    useState<ProximitySearchResult<MapEstablishment> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showPlaceResults, setShowPlaceResults] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);

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

  const {
    googleResults,
    appResults,
    hasResults: hasPlaceResults,
    isLoading: isSearchingPlaces,
    resolveGooglePlace,
    resetSessionToken,
    debouncedQuery,
  } = usePlaceSearch(searchQuery, centerCoordinates, searchRadiusMeters, {
    minLength: 2,
    debounceDelay: 300,
    googleLimit: 5,
    appLimit: 10,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Offer fetching: loads around current center OR selected place
  // ─────────────────────────────────────────────────────────────────────────

  const offerCenter = selectedPlace?.coordinates ?? centerCoordinates;

  const searchParams = useMemo(
    () => ({
      center: offerCenter,
      radius: searchRadiusMeters,
      limit: 50,
      sortByDistance: true,
    }),
    [offerCenter, searchRadiusMeters],
  );

  const {
    data: offers,
    isLoading: isLoadingOffers,
    refetch,
    isRefetching,
  } = useNearbyOffers(searchParams);

  // Map establishments (with embedded offers) for map markers
  const { data: mapEstablishments } = useMapEstablishments(searchParams);
  const displayEstablishments = mapEstablishments ?? [];

  // Offers to display (no client-side text filter — offers load for selected place)
  const displayOffers = offers ?? [];

  // Map region based on center and radius
  const mapRegion: Region = useMemo(() => {
    const latDelta = (searchRadius / 111) * 2.5;
    const lngDelta = latDelta * 1.2;
    return {
      latitude: offerCenter.latitude,
      longitude: offerCenter.longitude,
      latitudeDelta: Math.max(0.02, Math.min(latDelta, 1)),
      longitudeDelta: Math.max(0.02, Math.min(lngDelta, 1)),
    };
  }, [offerCenter, searchRadius]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setShowPlaceResults(text.length >= 2);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setShowPlaceResults(false);
    resetSessionToken();
  }, [resetSessionToken]);

  /**
   * Handle selecting a Google Places result from dropdown
   */
  const handleGooglePlaceSelect = useCallback(
    async (place: ILocationResult) => {
      let coords = place.coords;

      // Resolve coordinates via Place Details (billed call, concludes session)
      if (place.googlePlaceId != null) {
        const resolved = await resolveGooglePlace(place.googlePlaceId);
        if (resolved) {
          coords = resolved.coords;
        } else {
          return; // Failed to resolve
        }
      }

      const placeCoords = { latitude: coords.lat, longitude: coords.lng };
      const placeName = place.name || 'Unknown';
      const placeAddress = place.subtext ?? place.formattedAddress ?? '';

      setSelectedPlace({ name: placeName, address: placeAddress, coordinates: placeCoords });
      setManualLocationValue(placeCoords, placeName);
      setSearchQuery('');
      setShowPlaceResults(false);
      setSelectedEstablishment(null);

      // Animate map to selected place
      mapRef.current?.animateToRegion(
        {
          ...placeCoords,
          latitudeDelta: (searchRadius / 111) * 2.5,
          longitudeDelta: (searchRadius / 111) * 3,
        },
        500,
      );
    },
    [resolveGooglePlace, setManualLocationValue, searchRadius],
  );

  /**
   * Handle selecting an app establishment from dropdown
   */
  const handleAppEstablishmentSelect = useCallback(
    (establishment: ProximitySearchResult<NearbyEstablishment>) => {
      const est = establishment.item;
      const estCoords = {
        latitude: est.coordinates?.latitude ?? establishment.geoData.coordinates.latitude,
        longitude: est.coordinates?.longitude ?? establishment.geoData.coordinates.longitude,
      };

      const address = est.address?.formattedAddress ?? est.address?.city ?? '';

      setSelectedPlace({ name: est.name, address, coordinates: estCoords });
      setManualLocationValue(estCoords, est.name);
      setSearchQuery('');
      setShowPlaceResults(false);
      setSelectedEstablishment(null);

      // Animate map to selected establishment
      mapRef.current?.animateToRegion(
        {
          ...estCoords,
          latitudeDelta: (searchRadius / 111) * 2.5,
          longitudeDelta: (searchRadius / 111) * 3,
        },
        500,
      );
    },
    [setManualLocationValue, searchRadius],
  );

  const handleCloseBottomSheet = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  const handleBottomSheetOfferPress = useCallback(
    (offerId: string) => {
      prefetchOffer(offerId);
      navigation.navigate('OfferDetails', { offerId });
    },
    [navigation, prefetchOffer],
  );

  const handleLocationPress = useCallback(() => {
    setShowLocationModal(true);
  }, []);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleRadiusChange = useCallback(
    (radius: number) => {
      setRadius(radius);
      const latDelta = (radius / 111) * 2.5;
      const lngDelta = latDelta * 1.2;
      mapRef.current?.animateToRegion(
        {
          latitude: offerCenter.latitude,
          longitude: offerCenter.longitude,
          latitudeDelta: Math.max(0.02, Math.min(latDelta, 1)),
          longitudeDelta: Math.max(0.02, Math.min(lngDelta, 1)),
        },
        300,
      );
    },
    [setRadius, offerCenter],
  );

  const handleLocationSelect = useCallback(
    (location: { coordinates: { latitude: number; longitude: number }; name: string }) => {
      setManualLocationValue(location.coordinates, location.name);
      setSelectedPlace(null);
      mapRef.current?.animateToRegion(
        {
          ...location.coordinates,
          latitudeDelta: mapRegion.latitudeDelta,
          longitudeDelta: mapRegion.longitudeDelta,
        },
        500,
      );
    },
    [setManualLocationValue, mapRegion],
  );

  const handleUseMyLocation = useCallback(async () => {
    try {
      const result = await requestLocation();

      if (!result.success || !result.coordinates) {
        return;
      }

      setSelectedPlace(null);

      mapRef.current?.animateToRegion(
        {
          ...result.coordinates,
          latitudeDelta: mapRegion.latitudeDelta,
          longitudeDelta: mapRegion.longitudeDelta,
        },
        500,
      );

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
  }, [requestLocation, mapRegion, dispatch]);

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
      mapRef.current?.animateToRegion(
        {
          latitude: est.geoData.coordinates.latitude,
          longitude: est.geoData.coordinates.longitude,
          latitudeDelta: mapRegion.latitudeDelta * 0.5,
          longitudeDelta: mapRegion.longitudeDelta * 0.5,
        },
        300,
      );
    },
    [mapRegion],
  );

  const handleEstablishmentOfferPress = useCallback(
    (offerId: string) => {
      prefetchOffer(offerId);
      navigation.navigate('OfferDetails', { offerId });
    },
    [navigation, prefetchOffer],
  );

  const handleOfferPress = useCallback(
    (offer: ProximitySearchResult<NearbyOffer>) => {
      prefetchOffer(offer.item._id);
      navigation.navigate('OfferDetails', { offerId: offer.item._id });
    },
    [navigation, prefetchOffer],
  );

  const handleMapPress = useCallback((event?: { nativeEvent?: { action?: string } }) => {
    // On Android, MapView.onPress fires for marker taps too.
    // Only clear selection when the background map itself is tapped.
    if (event?.nativeEvent?.action === 'marker-press') return;
    setSelectedEstablishment(null);
  }, []);

  const handleRecenter = useCallback(() => {
    mapRef.current?.animateToRegion(mapRegion, 300);
  }, [mapRegion]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setSelectedEstablishment(null);
  }, []);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    setMapError(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render Functions
  // ─────────────────────────────────────────────────────────────────────────

  const renderListItem = useCallback(
    ({ item }: { item: ProximitySearchResult<NearbyOffer> }) => {
      const offerData = mapSearchResultToOfferListItem(item);

      return (
        <FavoriteOfferCard
          offer={offerData}
          variant='default'
          imageAspectRatio={1.4}
          onPress={() => handleOfferPress(item)}
          testID={`search-offer-${item.item._id}`}
          style={styles.offerCardItem}
        />
      );
    },
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
          {displayOffers.length} {displayOffers.length === 1 ? 'offer' : 'offers'} nearby
        </Text>
        <Text variant='body' size='sm' color='secondary'>
          Within {searchRadius} km
          {selectedPlace ? ` of ${selectedPlace.name}` : ''}
        </Text>
      </View>
    ),
    [displayOffers.length, searchRadius, selectedPlace],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Dropdown Render
  // ─────────────────────────────────────────────────────────────────────────

  const renderDropdown = () => {
    if (!showPlaceResults || viewMode !== 'map') return null;

    const showLoading = isSearchingPlaces && appResults.length === 0 && googleResults.length === 0;
    const showEmpty = !isSearchingPlaces && debouncedQuery.length >= 2 && !hasPlaceResults;

    return (
      <View style={[styles.placeResultsContainer, { backgroundColor: theme.colors.background }]}>
        {showLoading ? (
          <View style={styles.placeResultsLoading}>
            <ActivityIndicator size='small' color={theme.colors.primary} />
            <Text variant='body' size='sm' color='secondary' style={styles.placeResultsLoadingText}>
              Searching...
            </Text>
          </View>
        ) : showEmpty ? (
          <View style={styles.placeResultsEmpty}>
            <Text variant='body' size='sm' color='secondary'>
              No results found for &quot;{debouncedQuery}&quot;
            </Text>
          </View>
        ) : (
          <>
            {/* App Establishments Section */}
            {appResults.length > 0 && (
              <>
                <Text variant='label' size='xs' color='secondary' style={styles.placeResultsHeader}>
                  In WasteFood
                </Text>
                {appResults.slice(0, 4).map((est, index) => (
                  <Pressable
                    key={`app-${est.item._id}`}
                    style={[
                      styles.placeResultItem,
                      { borderBottomColor: theme.colors.outline },
                      index === Math.min(appResults.length - 1, 3) &&
                        googleResults.length === 0 &&
                        styles.placeResultItemLast,
                    ]}
                    onPress={() => handleAppEstablishmentSelect(est)}
                    accessibilityRole='button'
                    accessibilityLabel={est.item.name}
                    accessibilityHint={`Select ${est.item.address?.city ?? est.distance.formatted} to view offers`}
                  >
                    <View
                      style={[
                        styles.placeResultIcon,
                        { backgroundColor: theme.colors.primaryContainer },
                      ]}
                    >
                      <Icon
                        name='storefront-outline'
                        family='Ionicons'
                        size={16}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.placeResultText}>
                      <Text variant='body' size='sm' weight='medium' numberOfLines={1}>
                        {est.item.name}
                      </Text>
                      <Text variant='body' size='xs' color='secondary' numberOfLines={1}>
                        {est.item.address?.city ?? est.distance.formatted}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sourceBadge,
                        { backgroundColor: theme.colors.primaryContainer },
                      ]}
                    >
                      <Text variant='label' size='xs' color='primary'>
                        App
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {/* Google Places Section */}
            {googleResults.length > 0 && (
              <>
                <Text variant='label' size='xs' color='secondary' style={styles.placeResultsHeader}>
                  More places
                </Text>
                {googleResults.slice(0, 4).map((place, index) => (
                  <Pressable
                    key={`google-${place.id}`}
                    style={[
                      styles.placeResultItem,
                      { borderBottomColor: theme.colors.outline },
                      index === Math.min(googleResults.length - 1, 3) && styles.placeResultItemLast,
                    ]}
                    onPress={() => {
                      void handleGooglePlaceSelect(place);
                    }}
                    accessibilityRole='button'
                    accessibilityLabel={place.name}
                    accessibilityHint={`Select ${place.subtext} to search nearby offers`}
                  >
                    <View
                      style={[
                        styles.placeResultIcon,
                        { backgroundColor: theme.colors.surfaceVariant },
                      ]}
                    >
                      <Icon
                        name='location-sharp'
                        family='Ionicons'
                        size={16}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </View>
                    <View style={styles.placeResultText}>
                      <Text variant='body' size='sm' weight='medium' numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text variant='body' size='xs' color='secondary' numberOfLines={1}>
                        {place.subtext}
                      </Text>
                    </View>
                    <Icon
                      name='arrow-forward'
                      family='Ionicons'
                      size={16}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle='dark-content' backgroundColor={theme.colors.background} />

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
                Map Unavailable
              </Text>
              <Text variant='body' size='sm' color='secondary' align='center'>
                Unable to load the map. Please check your internet connection and try again.
              </Text>
              <Pressable
                style={[styles.mapRetryButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setMapError(null)}
                accessibilityRole='button'
                accessibilityLabel='Retry loading map'
                accessibilityHint='Attempts to reload the map'
              >
                <Text
                  variant='label'
                  size='sm'
                  weight='semibold'
                  style={{ color: theme.colors.onPrimary }}
                >
                  Retry
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
                accessibilityLabel='Map showing nearby offers'
                accessibilityHint='Tap on markers to view establishment details'
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
                accessibilityLabel='Recenter map'
                accessibilityHint='Centers the map on your current location'
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
                  onClose={() => setSelectedEstablishment(null)}
                  onOfferPress={handleEstablishmentOfferPress}
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
                onClose={handleCloseBottomSheet}
                onOfferPress={handleBottomSheetOfferPress}
              />
            </>
          )}
        </View>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <FlashList
          data={displayOffers}
          keyExtractor={item => item.item._id}
          renderItem={renderListItem}
          estimatedItemSize={280}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderListEmpty}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: insets.top + 120,
          }}
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
              placeholder='Search businesses or places...'
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
              onFocus={() => searchQuery.length >= 2 && setShowPlaceResults(true)}
              onBlur={() => setTimeout(() => setShowPlaceResults(false), 200)}
            />
          </View>

          {/* Location Button */}
          <Pressable
            style={[styles.locationButton, { backgroundColor: theme.colors.background }]}
            onPress={handleLocationPress}
            accessibilityLabel='Location settings'
            accessibilityHint='Open location filter options'
          >
            <Icon name='location-sharp' family='Ionicons' size={22} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Unified Dropdown: App Establishments + Google Places */}
        {renderDropdown()}

        {/* Toggle Row */}
        <View style={styles.toggleRow}>
          <MapListToggle value={viewMode} onChange={handleViewModeChange} />
        </View>
      </View>

      {/* Location Filter Modal */}
      <LocationFilterModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
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
    right: 16,
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
  placeResultsContainer: {
    marginTop: 8,
    borderRadius: 14,
    shadowColor: SURFACE_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  placeResultsHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  placeResultsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  placeResultsLoadingText: {
    marginLeft: 8,
  },
  placeResultsEmpty: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  placeResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeResultItemLast: {
    borderBottomWidth: 0,
  },
  placeResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeResultText: {
    flex: 1,
    marginRight: 8,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listHeader: {
    paddingBottom: 16,
  },
  offerCardItem: {
    marginVertical: 8,
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
