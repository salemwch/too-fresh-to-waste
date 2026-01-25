/**
 * Search Screen
 *
 * Map-first search experience for discovering offers.
 * Features:
 * - Google Maps as primary view (centered on Sousse, Tunisia)
 * - Live search as you type (no search button)
 * - Location filter modal with distance slider
 * - Toggle between Map and List views
 * - Semi-transparent radius circle
 * - Beautiful offer cards
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, Input, Icon } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { FavoriteOfferCard } from '@/features/favorites';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyOffers, useLocationSearch, type ProximitySearchResult, type NearbyOffer, type GeocodeResult } from '@/features/offers/hooks';
import type { OfferListItem } from '@/features/offers/types/offer.types';
import { OfferType, CtaState, OfferStatus } from '@/features/offers/types/offer.types';

import {
  LocationFilterModal,
  OfferMapCard,
  MapListToggle,
  OfferMarker,
  type ViewMode,
} from '../components';

import type { SearchScreenNavigationProp } from '@/navigation/types';

// ============================================================================
// Constants
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default location: Sousse, Tunisia
const DEFAULT_LOCATION = {
  latitude: 35.8288,
  longitude: 10.6405,
};

const INITIAL_RADIUS_KM = 5;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ProximitySearchResult<NearbyOffer> to OfferListItem
 * Maps the search data structure to the standardized card format
 */
const mapSearchResultToOfferListItem = (
  result: ProximitySearchResult<NearbyOffer>,
): OfferListItem => {
  const { item, distance } = result;

  // Convert distance to meters
  let distanceInMeters = distance.value;
  if (distance.unit === 'kilometers') {
    distanceInMeters = distance.value * 1000;
  } else if (distance.unit === 'miles') {
    distanceInMeters = distance.value * 1609.34;
  }

  return {
    id: item._id,
    title: item.title,
    type: OfferType.SURPRISE_BAG, // Default type, could be enhanced with actual type from backend
    image: item.images?.[0] ?? undefined,
    pricing: {
      originalPrice: item.pricing.originalPrice,
      discountedPrice: item.pricing.discountedPrice,
      discountPercentage: item.pricing.discountPercentage,
      currency: item.pricing.currency as 'TND', // Backend enforces TND currency
    },
    availableQuantity: item.availableQuantity,
    availableUntil: item.availableUntil,
    establishment: {
      name: item.establishmentName,
    },
    distance: distanceInMeters,
    ctaState: item.availableQuantity > 0 ? CtaState.AVAILABLE : CtaState.SOLD_OUT,
    status: OfferStatus.ACTIVE,
  };
};

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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

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
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ProximitySearchResult<NearbyOffer> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showPlaceResults, setShowPlaceResults] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Geocoding for place search
  const { data: placeResults, isLoading: isSearchingPlaces } = useLocationSearch(
    debouncedQuery.length >= 2 ? debouncedQuery : '',
    { minLength: 2, limit: 5 },
  );

  // Use user location or default to Sousse
  const centerCoordinates = useMemo(() => {
    if (hasLocation && userCoordinates) {
      return userCoordinates;
    }
    return DEFAULT_LOCATION;
  }, [hasLocation, userCoordinates]);

  // Search radius (use preferredRadiusKm or default)
  const searchRadius = preferredRadiusKm || INITIAL_RADIUS_KM;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch nearby offers
  const searchParams = useMemo(() => {
    return {
      center: centerCoordinates,
      radius: searchRadius * 1000, // Convert km to meters
      limit: 50,
      sortByDistance: true,
      query: debouncedQuery || undefined,
    };
  }, [centerCoordinates, searchRadius, debouncedQuery]);

  const {
    data: offers,
    isLoading: isLoadingOffers,
    refetch,
    isRefetching,
  } = useNearbyOffers(searchParams);

  // Filter offers based on search query (client-side for real-time feel)
  const filteredOffers = useMemo(() => {
    if (!offers) return [];
    if (!debouncedQuery.trim()) return offers;

    const query = debouncedQuery.toLowerCase();
    return offers.filter(
      offer =>
        offer.item.title.toLowerCase().includes(query) ||
        offer.item.establishmentName.toLowerCase().includes(query) ||
        offer.item.categories?.some(cat => cat.toLowerCase().includes(query)),
    );
  }, [offers, debouncedQuery]);

  // Map region based on center and radius
  const mapRegion: Region = useMemo(() => {
    const latDelta = (searchRadius / 111) * 2.5; // 1 degree ~ 111km
    const lngDelta = latDelta * 1.2;
    return {
      latitude: centerCoordinates.latitude,
      longitude: centerCoordinates.longitude,
      latitudeDelta: Math.max(0.02, Math.min(latDelta, 1)),
      longitudeDelta: Math.max(0.02, Math.min(lngDelta, 1)),
    };
  }, [centerCoordinates, searchRadius]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setShowPlaceResults(text.length >= 2);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setShowPlaceResults(false);
  }, []);

  // Handle selecting a place from geocoding results
  const handlePlaceSelect = useCallback(
    (place: GeocodeResult) => {
      const cityName = place.address?.city ?? place.displayName.split(',')[0] ?? 'Unknown';
      setManualLocationValue(place.coordinates, cityName);
      setSearchQuery('');
      setDebouncedQuery('');
      setShowPlaceResults(false);

      // Animate map to selected place
      mapRef.current?.animateToRegion(
        {
          latitude: place.coordinates.latitude,
          longitude: place.coordinates.longitude,
          latitudeDelta: (searchRadius / 111) * 2.5,
          longitudeDelta: (searchRadius / 111) * 3,
        },
        500,
      );
    },
    [setManualLocationValue, searchRadius],
  );

  const handleLocationPress = useCallback(() => {
    setShowLocationModal(true);
  }, []);

  const handleRadiusChange = useCallback(
    (radius: number) => {
      setRadius(radius);
      // Animate map to show the new circle radius
      const latDelta = (radius / 111) * 2.5;
      const lngDelta = latDelta * 1.2;
      mapRef.current?.animateToRegion(
        {
          latitude: centerCoordinates.latitude,
          longitude: centerCoordinates.longitude,
          latitudeDelta: Math.max(0.02, Math.min(latDelta, 1)),
          longitudeDelta: Math.max(0.02, Math.min(lngDelta, 1)),
        },
        300,
      );
    },
    [setRadius, centerCoordinates],
  );

  const handleLocationSelect = useCallback(
    (location: { coordinates: { latitude: number; longitude: number }; name: string }) => {
      setManualLocationValue(location.coordinates, location.name);
      // Animate map to new location
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
    const result = await requestLocation();
    if (result.success && result.coordinates) {
      mapRef.current?.animateToRegion(
        {
          ...result.coordinates,
          latitudeDelta: mapRegion.latitudeDelta,
          longitudeDelta: mapRegion.longitudeDelta,
        },
        500,
      );
    }
  }, [requestLocation, mapRegion]);

  const handleMarkerPress = useCallback(
    (offer: ProximitySearchResult<NearbyOffer>) => {
      setSelectedOffer(offer);
      // Center map on selected marker
      mapRef.current?.animateToRegion(
        {
          latitude: offer.geoData.coordinates.latitude,
          longitude: offer.geoData.coordinates.longitude,
          latitudeDelta: mapRegion.latitudeDelta * 0.5,
          longitudeDelta: mapRegion.longitudeDelta * 0.5,
        },
        300,
      );
    },
    [mapRegion],
  );

  const handleOfferPress = useCallback(
    (offer: ProximitySearchResult<NearbyOffer>) => {
      navigation.navigate('OfferDetails', { offerId: offer.item._id });
    },
    [navigation],
  );

  const handleMapPress = useCallback(() => {
    setSelectedOffer(null);
  }, []);

  const handleRecenter = useCallback(() => {
    mapRef.current?.animateToRegion(mapRegion, 300);
  }, [mapRegion]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setSelectedOffer(null);
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
          <SkeletonOfferCard imageAspectRatio={1.4} style={{ marginBottom: 16 }} />
          <SkeletonOfferCard imageAspectRatio={1.4} style={{ marginBottom: 16 }} />
          <SkeletonOfferCard imageAspectRatio={1.4} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon name="search" family="Ionicons" size={48} color={theme.colors.onSurfaceVariant} />
        </View>
        <Text variant="title" size="lg" weight="semibold" align="center" style={styles.emptyTitle}>
          No offers found
        </Text>
        <Text variant="body" size="md" color="secondary" align="center" style={styles.emptyText}>
          {searchQuery
            ? `No results for "${searchQuery}". Try a different search or expand your radius.`
            : 'Try expanding your search radius or search for something specific.'}
        </Text>
      </View>
    );
  }, [isLoadingOffers, searchQuery, theme.colors]);

  const renderListHeader = useCallback(() => (
    <View style={styles.listHeader}>
      <Text variant="title" size="md" weight="semibold">
        {filteredOffers.length} {filteredOffers.length === 1 ? 'offer' : 'offers'} nearby
      </Text>
      <Text variant="body" size="sm" color="secondary">
        Within {searchRadius} km
      </Text>
    </View>
  ), [filteredOffers.length, searchRadius]);

  // ─────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

      {/* Map View */}
      {viewMode === 'map' && (
        <View style={styles.mapContainer}>
          {mapError ? (
            <View style={[styles.mapErrorContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Icon name="map-outline" family="Ionicons" size={48} color={theme.colors.onSurfaceVariant} />
              <Text variant="title" size="md" weight="semibold" align="center" style={styles.mapErrorTitle}>
                Map Unavailable
              </Text>
              <Text variant="body" size="sm" color="secondary" align="center">
                Unable to load the map. Please check your internet connection and try again.
              </Text>
              <TouchableOpacity
                style={[styles.mapRetryButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setMapError(null)}
                activeOpacity={0.8}
              >
                <Text variant="label" size="sm" weight="semibold" style={{ color: theme.colors.onPrimary }}>
                  Retry
                </Text>
              </TouchableOpacity>
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
            accessibilityLabel="Map showing nearby offers"
          >
            {/* Search radius circle */}
            <Circle
              center={centerCoordinates}
              radius={searchRadius * 1000}
              strokeColor={theme.colors.primary}
              strokeWidth={2}
              fillColor={`${theme.colors.primary}40`}
            />

            {/* Offer markers */}
            {mapReady &&
              filteredOffers.map(offer => (
                <OfferMarker
                  key={offer.item._id}
                  offer={offer}
                  isSelected={selectedOffer?.item._id === offer.item._id}
                  onPress={() => handleMarkerPress(offer)}
                />
              ))}
          </MapView>

          {/* Recenter button */}
          <TouchableOpacity
            style={[
              styles.recenterButton,
              {
                backgroundColor: theme.colors.background,
                top: SCREEN_HEIGHT * 0.4,
              },
            ]}
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <Icon
              name="locate"
              size={22}
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          {/* Loading overlay */}
          {isLoadingOffers && !filteredOffers.length && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}

          {/* Selected offer card */}
          <OfferMapCard
            offer={selectedOffer}
            visible={!!selectedOffer}
            onPress={() => selectedOffer && handleOfferPress(selectedOffer)}
            onClose={() => setSelectedOffer(null)}
          />
          </>
          )}
        </View>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <FlatList
          data={filteredOffers}
          keyExtractor={item => item.item._id}
          renderItem={renderListItem}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderListEmpty}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: insets.top + 120 }, // Space for search bar
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
              progressViewOffset={insets.top + 120}
            />
          }
        />
      )}

      {/* Search Bar Overlay */}
      <View
        style={[
          styles.searchOverlay,
          {
            paddingTop: insets.top + 8,
            backgroundColor: viewMode === 'map' ? 'transparent' : theme.colors.background,
          },
        ]}
      >
        {/* Search Row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background }]}>
            <Input
              placeholder="Search places or offers..."
              value={searchQuery}
              onChangeText={handleSearchChange}
              leftIcon="search-outline"
              leftIconFamily="Ionicons"
              rightIcon={searchQuery ? 'close-circle' : undefined}
              rightIconFamily="Ionicons"
              onRightIconPress={handleClearSearch}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.searchInput}
              containerStyle={styles.searchInputInner}
              onFocus={() => searchQuery.length >= 2 && setShowPlaceResults(true)}
              onBlur={() => setTimeout(() => setShowPlaceResults(false), 200)}
            />
          </View>

          {/* Location Button */}
          <TouchableOpacity
            style={[styles.locationButton, { backgroundColor: theme.colors.background }]}
            onPress={handleLocationPress}
            activeOpacity={0.8}
            accessibilityLabel="Location settings"
            accessibilityHint="Open location filter options"
          >
            <Icon
              name="location-sharp"
              family="Ionicons"
              size={22}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Place Search Results Dropdown */}
        {showPlaceResults && viewMode === 'map' && (
          <View style={[styles.placeResultsContainer, { backgroundColor: theme.colors.background }]}>
            {isSearchingPlaces ? (
              <View style={styles.placeResultsLoading}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text variant="body" size="sm" color="secondary" style={styles.placeResultsLoadingText}>
                  Searching places...
                </Text>
              </View>
            ) : placeResults && placeResults.length > 0 ? (
              <>
                <Text variant="label" size="xs" color="secondary" style={styles.placeResultsHeader}>
                  📍 Go to location
                </Text>
                {placeResults.slice(0, 4).map((place, index) => (
                  <TouchableOpacity
                    key={`${place.coordinates.latitude}-${index}`}
                    style={[
                      styles.placeResultItem,
                      { borderBottomColor: theme.colors.outline },
                      index === Math.min(placeResults.length - 1, 3) && styles.placeResultItemLast,
                    ]}
                    onPress={() => handlePlaceSelect(place)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.placeResultIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                      <Icon name="location-sharp" family="Ionicons" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.placeResultText}>
                      <Text variant="body" size="sm" weight="medium" numberOfLines={1}>
                        {(place.address?.city && place.address.city !== 'Unknown')
                          ? place.address.city
                          : (place.displayName?.split(',')[0] ?? 'Unknown location')}
                      </Text>
                      <Text variant="body" size="xs" color="secondary" numberOfLines={1}>
                        {place.displayName ?? ''}
                      </Text>
                    </View>
                    <Icon name="arrow-forward" family="Ionicons" size={16} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                ))}
              </>
            ) : debouncedQuery.length >= 2 ? (
              <View style={styles.placeResultsEmpty}>
                <Text variant="body" size="sm" color="secondary">
                  No places found for "{debouncedQuery}"
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Toggle Row */}
        <View style={styles.toggleRow}>
          <MapListToggle value={viewMode} onChange={handleViewModeChange} />

          {/* Results count badge */}
          {viewMode === 'map' && (
            <View style={[styles.resultsBadge, { backgroundColor: theme.colors.background }]}>
              <Text variant="label" size="sm" weight="semibold" color="primary">
                {filteredOffers.length} offers
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Location Filter Modal */}
      <LocationFilterModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        currentRadius={searchRadius}
        onRadiusChange={handleRadiusChange}
        onLocationSelect={handleLocationSelect}
        onUseMyLocation={handleUseMyLocation}
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
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
    shadowColor: '#000',
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
    shadowColor: '#000',
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
    shadowColor: '#000',
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
  resultsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  placeResultsContainer: {
    marginTop: 8,
    borderRadius: 14,
    shadowColor: '#000',
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
});

export default SearchScreen;
