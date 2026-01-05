/**
 * Nearby Offers Screen
 *
 * Displays offers on a map based on user location.
 * Features:
 * - MapView with user location and offer markers
 * - Bottom sheet with scrollable offer list
 * - Radius selector for adjusting search area
 * - Distance badges on each offer
 * - Empty state when no offers nearby
 * - Manual location fallback
 */

import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';

import { Text, Button, Card, Icon } from '@/design-system/components/atoms';
import { DistanceBadge, LocationStatusBadge } from '@/design-system/components/atoms';
import { RadiusSelector, NearbyOffersEmptyState } from '@/design-system/components/molecules';
import { ManualLocationModal } from '@/design-system/components/organisms';
import { useTheme } from '@/design-system/providers';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyOffers, type ProximitySearchResult, type NearbyOffer } from '@/features/offers/hooks';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// ============================================================================
// Types
// ============================================================================

type NearbyOffersScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'NearbyOffers'
>;

type NearbyOffersScreenRouteProp = RouteProp<MainStackParamList, 'NearbyOffers'>;

interface NearbyOffersScreenProps {
  navigation: NearbyOffersScreenNavigationProp;
  route: NearbyOffersScreenRouteProp;
}

// ============================================================================
// Constants
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT * 0.45;

// ============================================================================
// Component
// ============================================================================

export const NearbyOffersScreen: React.FC<NearbyOffersScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);

  // Location hook
  const {
    coordinates: locationCoordinates,
    preferredRadiusKm,
    setRadius,
    locationSourceDisplay,
    setManualLocationValue,
  } = useLocation();

  // Use route params or hook location
  const coordinates = useMemo(() => {
    if (route.params?.latitude && route.params?.longitude) {
      return {
        latitude: route.params.latitude,
        longitude: route.params.longitude,
      };
    }
    return locationCoordinates;
  }, [route.params?.latitude, route.params?.longitude, locationCoordinates]);

  // State
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [showManualLocationModal, setShowManualLocationModal] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Fetch nearby offers
  const searchParams = useMemo(() => {
    if (!coordinates) return null;
    return {
      center: coordinates,
      radius: preferredRadiusKm * 1000, // Convert km to meters
      limit: 50,
      sortByDistance: true,
    };
  }, [coordinates, preferredRadiusKm]);

  const {
    data: offers,
    isLoading,
    refetch,
    isRefetching,
  } = useNearbyOffers(searchParams);

  // Map region based on coordinates
  const mapRegion = useMemo(() => {
    if (!coordinates) return null;
    // Calculate delta based on radius (roughly)
    const latDelta = (preferredRadiusKm / 111) * 2; // 1 degree ~ 111km
    const lngDelta = latDelta * 1.5;
    return {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      latitudeDelta: Math.max(0.02, latDelta),
      longitudeDelta: Math.max(0.02, lngDelta),
    };
  }, [coordinates, preferredRadiusKm]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleRadiusChange = useCallback(
    (radiusKm: number) => {
      setRadius(radiusKm);
    },
    [setRadius],
  );

  const handleExpandRadius = useCallback(() => {
    const newRadius = Math.min(preferredRadiusKm * 2, 100);
    setRadius(newRadius);
  }, [preferredRadiusKm, setRadius]);

  const handleBrowseAll = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleOfferPress = useCallback(
    (offer: ProximitySearchResult<NearbyOffer>) => {
      setSelectedOfferId(offer.item._id);
      // Navigate to offer details
      navigation.navigate('OfferDetails', { offerId: offer.item._id });
    },
    [navigation],
  );

  const handleMarkerPress = useCallback(
    (offerId: string) => {
      setSelectedOfferId(offerId);
      // Scroll to offer in list
    },
    [],
  );

  const handleManualLocationSelect = useCallback(
    (location: { coordinates: { latitude: number; longitude: number }; name: string }) => {
      setManualLocationValue(location.coordinates, location.name);
      setShowManualLocationModal(false);
    },
    [setManualLocationValue],
  );

  const handleLocationBadgePress = useCallback(() => {
    setShowManualLocationModal(true);
  }, []);


  // ─────────────────────────────────────────────────────────────────────────
  // Render Functions
  // ─────────────────────────────────────────────────────────────────────────

  const renderOfferCard = useCallback(
    ({ item }: { item: ProximitySearchResult<NearbyOffer> }) => {
      const isSelected = selectedOfferId === item.item._id;
      return (
        <TouchableOpacity
          onPress={() => handleOfferPress(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.item.title}, ${item.distance.formatted} away`}
        >
          <Card
            style={[
              styles.offerCard,
              isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
            ]}
          >
            <View style={styles.offerContent}>
              <View style={styles.offerInfo}>
                <Text variant="title" size="sm" weight="semibold" numberOfLines={1}>
                  {item.item.title}
                </Text>
                <Text variant="body" size="sm" color="secondary" numberOfLines={1}>
                  {item.item.establishmentName}
                </Text>
                <View style={styles.offerMeta}>
                  <DistanceBadge distance={item.distance.value} variant="compact" />
                  <Text variant="body" size="sm" color="success" weight="semibold">
                    {item.item.pricing.currency}
                    {item.item.pricing.discountedPrice.toFixed(2)}
                  </Text>
                  <Text
                    variant="body"
                    size="xs"
                    color="secondary"
                    style={styles.originalPrice}
                  >
                    {item.item.pricing.currency}
                    {item.item.pricing.originalPrice.toFixed(2)}
                  </Text>
                </View>
              </View>
              <Icon
                name="chevron-forward"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </Card>
        </TouchableOpacity>
      );
    },
    [selectedOfferId, handleOfferPress, theme.colors],
  );

  const renderListHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.listHeaderRow}>
          <Text variant="title" size="md" weight="semibold">
            {offers?.length ?? 0} offers nearby
          </Text>
          <LocationStatusBadge
            mode={locationSourceDisplay.mode}
            locationName={locationSourceDisplay.label}
            size="sm"
            onPress={handleLocationBadgePress}
          />
        </View>
        <View style={styles.radiusHeader}>
          <Text variant="label" size="sm" color="secondary">
            Search radius
          </Text>
          <Text variant="title" size="sm" weight="semibold" color="primary">
            {preferredRadiusKm} km
          </Text>
        </View>
        <RadiusSelector
          value={preferredRadiusKm}
          onChange={handleRadiusChange}
          variant="chips"
          presets={[1, 2, 5, 10, 25, 50]}
          style={styles.radiusSelector}
        />
      </View>
    ),
    [offers?.length, locationSourceDisplay, preferredRadiusKm, handleRadiusChange, handleLocationBadgePress],
  );

  const renderEmptyState = useCallback(
    () => (
      <NearbyOffersEmptyState
        radiusKm={preferredRadiusKm}
        onExpandRadius={handleExpandRadius}
        onBrowseAll={handleBrowseAll}
      />
    ),
    [preferredRadiusKm, handleExpandRadius, handleBrowseAll],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Loading & Error States
  // ─────────────────────────────────────────────────────────────────────────

  // No location available
  if (!coordinates) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centeredContainer}>
          <Icon name="location-outline" family="Ionicons" size={64} color={theme.colors.onSurfaceVariant} />
          <Text variant="title" size="lg" weight="semibold" align="center" style={styles.errorTitle}>
            Location Required
          </Text>
          <Text variant="body" size="md" color="secondary" align="center" style={styles.errorText}>
            Please enable location or set a manual location to see nearby offers.
          </Text>
          <Button
            variant="primary"
            size="lg"
            onPress={() => setShowManualLocationModal(true)}
            style={styles.actionButton}
          >
            Set Location
          </Button>
          <Button
            variant="outline"
            size="md"
            onPress={() => navigation.goBack()}
            style={styles.actionButton}
          >
            Go Back
          </Button>
        </View>
        <ManualLocationModal
          visible={showManualLocationModal}
          onClose={() => setShowManualLocationModal(false)}
          onLocationSelect={handleManualLocationSelect}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Map View */}
      {mapRegion && (
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
              <Button
                variant="outline"
                size="sm"
                onPress={() => setMapError(null)}
                style={styles.mapRetryButton}
              >
                Retry
              </Button>
            </View>
          ) : (
          <>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapRegion}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass
            onMapReady={() => setMapError(null)}
            accessibilityLabel="Map showing nearby offers"
          >
            {/* Search radius circle */}
            <Circle
              center={coordinates}
              radius={preferredRadiusKm * 1000}
              strokeColor={theme.colors.primary}
              strokeWidth={2}
              fillColor={`${theme.colors.primary}20`}
            />

            {/* Offer markers */}
            {offers?.map((offer) => (
              <Marker
                key={offer.item._id}
                coordinate={{
                  latitude: offer.geoData.coordinates.latitude,
                  longitude: offer.geoData.coordinates.longitude,
                }}
                title={offer.item.title}
                description={`${offer.distance.formatted} - ${offer.item.pricing.currency}${offer.item.pricing.discountedPrice}`}
                onPress={() => handleMarkerPress(offer.item._id)}
                pinColor={selectedOfferId === offer.item._id ? theme.colors.primary : theme.colors.secondary}
              />
            ))}
          </MapView>

          {/* Recenter button */}
          <TouchableOpacity
            style={[styles.recenterButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => {
              mapRef.current?.animateToRegion(mapRegion, 300);
            }}
            accessibilityRole="button"
            accessibilityLabel="Recenter map"
            accessibilityHint="Centers the map on your current location"
          >
            <Icon name="locate" family="Ionicons" size={22} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* Radius indicator on map */}
          <View style={[styles.radiusIndicator, { backgroundColor: theme.colors.surface }]}>
            <Icon name="radio-button-on" family="Ionicons" size={14} color={theme.colors.primary} style={styles.radiusIndicatorIcon} />
            <Text variant="label" size="xs" weight="semibold" color="primary">
              {preferredRadiusKm} km
            </Text>
          </View>

          {/* Loading overlay on map */}
          {isLoading && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}
          </>
          )}
        </View>
      )}

      {/* Offers List */}
      <View style={styles.listContainer}>
        <FlatList
          data={offers || []}
          keyExtractor={(item) => item.item._id}
          renderItem={renderOfferCard}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={isLoading ? null : renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
        />

        {/* Loading indicator */}
        {isLoading && !offers && (
          <View style={styles.listLoadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="body" size="md" color="secondary" style={styles.loadingText}>
              Finding nearby offers...
            </Text>
          </View>
        )}
      </View>

      {/* Manual Location Modal */}
      <ManualLocationModal
        visible={showManualLocationModal}
        onClose={() => setShowManualLocationModal(false)}
        onLocationSelect={handleManualLocationSelect}
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    marginBottom: 24,
  },
  actionButton: {
    minWidth: 200,
    marginTop: 12,
  },
  mapContainer: {
    height: MAP_HEIGHT,
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
    minWidth: 120,
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  radiusIndicator: {
    position: 'absolute',
    left: 16,
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  radiusIndicatorIcon: {
    marginRight: 4,
  },
  listContainer: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radiusSelector: {
    marginBottom: 8,
  },
  offerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
  },
  offerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerInfo: {
    flex: 1,
  },
  offerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },
  listLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 12,
  },
});

export default NearbyOffersScreen;
