/**
 * Home Screen
 * Main dashboard displaying featured offers, nearby offers, and quick actions
 *
 * Features:
 * - Community donation impact banner (ImpactBanner)
 * - Location prompt banner for enabling nearby offers
 * - Featured offers and nearby deals
 * - Personal impact stats
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSelector } from 'react-redux';

import { Text, Button, Card, Icon, Input } from '@/design-system/components/atoms';
import { LocationPromptBanner, SkeletonOfferCard } from '@/design-system/components/molecules';
import { ManualLocationModal, LocationSelectionModal } from '@/design-system/components/organisms';
import { useTheme } from '@/design-system/providers';
import { ImpactBanner } from '@/features/donations';
import { FavoriteOfferCard } from '@/features/favorites';
import {
  useUrgentOffers,
  useRecommendedOffers,
  useOffers,
  usePickupTodayOffers,
  usePickupTomorrowOffers,
} from '@/features/offers/hooks/useOffers';
import {
  OfferStatus,
  EstablishmentType,
  type OfferSearchParams,
} from '@/features/offers/types/offer.types';
import { userService } from '@/features/profile/services';
import { FilterBottomSheet, ActiveFilterChips } from '@/features/search/components';
import {
  INITIAL_FILTER_STATE,
  hasActiveFilters,
  countActiveFilters,
} from '@/features/search/types/filter.types';
import { useLocation } from '@/hooks/useLocation';
import { analytics } from '@/utils/analytics';
import { Logger } from '@/utils/logger';

import type { FilterState } from '@/features/search/types/filter.types';
import type { HomeScreenNavigationProp } from '@/navigation/types';
import type { RootState } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const LOCATION_SETUP_COMPLETED_KEY = '@location_required_v1';
const FILTERS_STORAGE_KEY = '@home_filters_v1';

// Style constants
const COLORS: { readonly BLACK: string; readonly WHITE: string } = {
  BLACK: '#000',
  WHITE: '#FFFFFF',
};

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Location hook
  const {
    coordinates,
    hasLocation,
    isLoading: isLocationLoading,
    shouldShowPrompt,
    requestLocation,
    dismissLocationPrompt,
    setManualLocationValue,
  } = useLocation();

  // Filter state
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // Convert filter state to API params (memoized for performance)
  const filterParams = useMemo(() => {
    try {
      const params: Partial<
        Pick<OfferSearchParams, 'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories'>
      > = {};

      // ✅ Input validation and sanitization
      if (filters.offerType != null) {
        params.type = filters.offerType;
      }

      // ✅ FIXED: Backend now supports multiple establishment types
      if (filters.establishmentTypes.length > 0) {
        // Validate and sanitize establishment types
        const validTypes = filters.establishmentTypes.filter(
          type => Boolean(type) && Object.values(EstablishmentType).includes(type),
        );
        if (validTypes.length > 0) {
          params.establishmentTypes = [...validTypes]; // Defensive copy
        }
      }

      // Validate and sanitize cuisine types
      if (filters.cuisineTypes.length > 0) {
        const validCuisines = filters.cuisineTypes.filter(
          cuisine => typeof cuisine === 'string' && cuisine.trim().length > 0,
        );
        if (validCuisines.length > 0) {
          params.cuisineTypes = validCuisines.map(c => c.trim()); // Sanitize
        }
      }

      // Validate and sanitize categories
      if (filters.categories.length > 0) {
        const validCategories = filters.categories.filter(
          category => typeof category === 'string' && category.trim().length > 0,
        );
        if (validCategories.length > 0) {
          params.categories = validCategories.map(c => c.trim()); // Sanitize
        }
      }

      Logger.debug('Filter params computed', { params, originalFilters: filters });
      return params;
    } catch (error) {
      // ✅ Error boundary: Graceful degradation
      Logger.error('Failed to convert filters to params', { error, filters });
      return {}; // Fallback to no filters
    }
  }, [filters]);

  // Recommended offers query (personalized, requires auth)
  const {
    data: _recommendedOffers,
    isLoading: _isRecommendedLoading,
    error: _recommendedError,
    refetch: refetchRecommended,
  } = useRecommendedOffers(
    10,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
  );

  // ✅ FIXED: Urgent offers query (expiring within 1 hours) - with distance if location available
  // This replaces the previous featured offers query which was showing ALL featured offers
  // (including manually featured ones with 11+ hours remaining)
  const {
    data: urgentOffers,
    isLoading: isUrgentLoading,
    error: urgentError,
    refetch: refetchUrgent,
  } = useUrgentOffers(
    1, // Only show offers expiring within 1 hours
    10,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
  );

  // Hottest deals query (highest discounts) - with distance if location available
  const {
    data: hottestDeals,
    isLoading: isHottestLoading,
    error: hottestError,
    refetch: refetchHottest,
  } = useOffers(
    {
      status: OfferStatus.ACTIVE,
      minDiscount: 70,
      limit: 10,
      ...filterParams,
    },
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    {},
  );

  // Pickup Today offers query - offers available for pickup today
  const {
    data: pickupTodayOffers,
    isLoading: isPickupTodayLoading,
    error: pickupTodayError,
    refetch: refetchPickupToday,
  } = usePickupTodayOffers(
    20,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    filterParams,
  );

  // Pickup Tomorrow offers query - offers available for pickup tomorrow
  const {
    data: pickupTomorrowOffers,
    isLoading: isPickupTomorrowLoading,
    error: pickupTomorrowError,
    refetch: refetchPickupTomorrow,
  } = usePickupTomorrowOffers(
    20,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    filterParams,
  );

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [showManualLocationModal, setShowManualLocationModal] = useState(false);
  const [showLocationSelectionModal, setShowLocationSelectionModal] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  /**
   * Load persisted filters on mount
   */
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
        if (stored != null) {
          const parsedFilters = JSON.parse(stored) as FilterState;
          setFilters(parsedFilters);
          Logger.debug('Filters restored from storage', parsedFilters);
        }
      } catch (error) {
        Logger.error('Failed to load persisted filters', { error });
      }
    };
    void loadFilters();
  }, []);

  /**
   * Persist filters when they change
   */
  useEffect(() => {
    const persistFilters = async () => {
      try {
        await AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
        Logger.debug('Filters persisted to storage', filters);
      } catch (error) {
        Logger.error('Failed to persist filters', { error });
      }
    };
    void persistFilters();
  }, [filters]);

  /**
   * Check if location setup modal should be shown (first time user)
   * Also fetch location from backend if user is authenticated but has no local location
   */
  useEffect(() => {
    const checkLocationSetup = async () => {
      try {
        const hasCompleted = await AsyncStorage.getItem(LOCATION_SETUP_COMPLETED_KEY);

        // If authenticated, no local location, but has completed setup before (returning user on new device)
        // Try fetching from backend. Skip for brand new users (hasCompleted === null)
        if (isAuthenticated && !hasLocation && hasCompleted !== null) {
          try {
            Logger.debug('[HomeScreen] Attempting to restore location from backend...');
            const profile = await userService.getCurrentProfile();

            // Check if user has location preferences set
            if (profile?.locationPreferences?.defaultLocation) {
              const { latitude, longitude } = profile.locationPreferences.defaultLocation;
              Logger.debug('[HomeScreen] Location found in backend, restoring...');

              // Set location from backend
              setManualLocationValue({ latitude, longitude }, 'Synced from server');
              await AsyncStorage.setItem(LOCATION_SETUP_COMPLETED_KEY, 'true');
              Logger.debug('[HomeScreen] Location restored from backend successfully');
              return; // Don't show modal if we got location from backend
            }
            Logger.debug('[HomeScreen] No location found in backend for this user');
          } catch (error) {
            // Non-blocking: if backend fetch fails, continue with modal flow
            Logger.error('[HomeScreen] Failed to fetch location from backend:', error);
          }
        }

        // Show modal if user hasn't completed setup AND doesn't have location set
        if (hasCompleted == null && !hasLocation) {
          Logger.debug('[HomeScreen] First-time user, showing location modal');
          setShowLocationSelectionModal(true);
        } else if (hasCompleted !== null && !hasLocation) {
          // Returning user but no location (edge case)
          Logger.debug('[HomeScreen] Returning user with no location, showing modal');
          setShowLocationSelectionModal(true);
        }
      } catch (error) {
        Logger.error('[HomeScreen] Failed to check location setup:', error);
      }
    };

    void checkLocationSetup();
  }, [hasLocation, isAuthenticated, setManualLocationValue]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchRecommended(),
      refetchUrgent(),
      refetchHottest(),
      refetchPickupToday(),
      refetchPickupTomorrow(),
    ]);
    setRefreshing(false);
  }, [
    refetchRecommended,
    refetchUrgent,
    refetchHottest,
    refetchPickupToday,
    refetchPickupTomorrow,
  ]);

  /**
   * Handle enabling location
   */
  const handleEnableLocation = useCallback(async () => {
    const result = await requestLocation();
    if (!result.success) {
      // If location request failed, show manual location modal
      setShowManualLocationModal(true);
    }
  }, [requestLocation]);

  /**
   * Handle manual location selection
   */
  const handleManualLocationSelect = useCallback(
    (location: { coordinates: { latitude: number; longitude: number }; name: string }) => {
      setManualLocationValue(location.coordinates, location.name);
      setShowManualLocationModal(false);
    },
    [setManualLocationValue],
  );

  /**
   * Navigate to nearby offers
   * TODO: Wire this up to a "View All" button
   */
  // @ts-expect-error - TODO: Wire this up to a "View All" button
  const _handleViewNearbyOffers = useCallback(async () => {
    if (hasLocation && coordinates) {
      // Navigate with current location
      navigation.navigate('NearbyOffers', {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
    } else {
      // Request location first
      const result = await requestLocation();
      if (result.success && result.coordinates) {
        navigation.navigate('NearbyOffers', {
          latitude: result.coordinates.latitude,
          longitude: result.coordinates.longitude,
        });
      } else {
        // Show manual location modal if permission denied
        setShowManualLocationModal(true);
      }
    }
  }, [hasLocation, coordinates, requestLocation, navigation]);

  /**
   * Navigate to category search
   */
  const handleCategoryPress = useCallback(
    (category: string) => {
      navigation.navigate('Search', { category });
    },
    [navigation],
  );

  /**
   * Handle location selection from LocationSelectionModal
   */
  const handleLocationSelection = useCallback(
    async (coordinates: { latitude: number; longitude: number }, name: string) => {
      setLocationError(null);

      // Check if GPS was requested (coordinates are 0,0 as signal)
      if (coordinates.latitude === 0 && coordinates.longitude === 0 && name === 'gps') {
        const result = await requestLocation();
        if (result.success && result.coordinates) {
          // GPS location obtained successfully
          setShowLocationSelectionModal(false);
          await AsyncStorage.setItem(LOCATION_SETUP_COMPLETED_KEY, 'true');

          // Sync location to backend for cross-device persistence
          try {
            if (isAuthenticated) {
              await userService.updateLocation({
                latitude: result.coordinates.latitude,
                longitude: result.coordinates.longitude,
                source: 'gps',
              });
            }
          } catch (error) {
            // Non-blocking: log error but don't prevent local storage
            Logger.error('[HomeScreen] Failed to sync location to backend:', error);
          }
        } else {
          // GPS failed, show error and keep modal open
          setLocationError(
            result.error ?? 'Failed to get your location. Please try another option.',
          );
        }
      } else {
        // Manual location or default location selected
        setManualLocationValue(coordinates, name);
        setShowLocationSelectionModal(false);
        await AsyncStorage.setItem(LOCATION_SETUP_COMPLETED_KEY, 'true');

        // Sync location to backend for cross-device persistence
        try {
          if (isAuthenticated) {
            await userService.updateLocation({
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              locationName: name,
              source: 'manual',
            });
          }
        } catch (error) {
          // Non-blocking: log error but don't prevent local storage
          Logger.error('[HomeScreen] Failed to sync location to backend:', error);
        }
      }
    },
    [requestLocation, setManualLocationValue, isAuthenticated],
  );

  /**
   * Filter handlers
   */
  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    // Track filter usage analytics
    analytics.trackFiltersApplied({
      ...(newFilters.offerType != null && { offerType: String(newFilters.offerType) }),
      establishmentCount: newFilters.establishmentTypes.length,
      establishmentTypes: newFilters.establishmentTypes.map(String),
      cuisineCount: newFilters.cuisineTypes.length,
      cuisineTypes: newFilters.cuisineTypes,
      categoryCount: newFilters.categories.length,
      categories: newFilters.categories,
      totalFilters: countActiveFilters(newFilters),
      source: 'home_screen',
    });

    setFilters(newFilters);
    setIsFilterVisible(false);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    // Track analytics
    analytics.trackFiltersCleared({
      previousFilterCount: countActiveFilters(filters),
      source: 'home_screen',
    });

    setFilters(INITIAL_FILTER_STATE);
  }, [filters]);

  const handleRemoveOfferType = useCallback(() => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'offerType',
      value: filters.offerType ?? 'unknown',
      source: 'home_screen',
    });

    setFilters(prev => ({ ...prev, offerType: null }));
  }, [filters.offerType]);

  const handleRemoveEstablishmentType = useCallback((type: EstablishmentType) => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'establishmentType',
      value: type,
      source: 'home_screen',
    });

    setFilters(prev => ({
      ...prev,
      establishmentTypes: prev.establishmentTypes.filter(t => t !== type),
    }));
  }, []);

  const handleRemoveCuisineType = useCallback((cuisine: string) => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'cuisineType',
      value: cuisine,
      source: 'home_screen',
    });

    setFilters(prev => ({
      ...prev,
      cuisineTypes: prev.cuisineTypes.filter(c => c !== cuisine),
    }));
  }, []);

  const handleRemoveCategory = useCallback((category: string) => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'category',
      value: category,
      source: 'home_screen',
    });

    setFilters(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category),
    }));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessibilityLabel='Home screen content'
        accessibilityHint='Scroll to view featured offers, nearby deals, and your impact'
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={theme.colors.primary}
            accessibilityLabel={refreshing ? 'Refreshing offers' : 'Pull to refresh'}
          />
        }
      >
        {/* Location Prompt Banner - Show when user hasn't enabled location */}
        {shouldShowPrompt && (
          <View style={styles.bannerWrapper}>
            <LocationPromptBanner
              onEnable={() => {
                void handleEnableLocation();
              }}
              onDismiss={dismissLocationPrompt}
              isLoading={isLocationLoading}
              testID='location-prompt-banner'
            />
          </View>
        )}

        {/* Search Bar + Filter Button */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Input
              placeholder='Search by establishment, cuisine or food...'
              leftIcon={<Icon name='search' size={20} color={theme.colors.onSurfaceVariant} />}
              onFocus={() => navigation.navigate('Search')}
              editable={false}
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => setIsFilterVisible(true)}
            accessibilityLabel={`Filters ${hasActiveFilters(filters) ? `(${countActiveFilters(filters)} active)` : ''}`}
          >
            <Icon name='filter-list' size={24} color={theme.colors.onSurface} />
            {hasActiveFilters(filters) && (
              <View style={[styles.filterBadge, { backgroundColor: theme.colors.accent }]}>
                <Text style={styles.filterBadgeText}>{countActiveFilters(filters)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active Filter Chips */}
        {hasActiveFilters(filters) && (
          <ActiveFilterChips
            filters={filters}
            onRemoveOfferType={handleRemoveOfferType}
            onRemoveEstablishmentType={handleRemoveEstablishmentType}
            onRemoveCuisineType={handleRemoveCuisineType}
            onRemoveCategory={handleRemoveCategory}
            onClearAll={handleClearAllFilters}
          />
        )}

        {/* 🌍 Community Donation Impact Banner */}
        <View style={styles.bannerWrapper}>
          <ImpactBanner
            onExpand={() => {
              // TODO: Track analytics when user expands the banner
              // analytics.track('community_impact_banner_expanded');
            }}
          />
        </View>

        {/* Recommended Offers Section (Personalized - Auth Required) */}
        {/* ✅ FIXED: Urgent Deals Section - Now shows only offers expiring within 1 hour */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant='title' size='lg' weight='semibold'>
              Urgent Deals ⚡
            </Text>
            <Button
              variant='ghost'
              size='sm'
              onPress={() => navigation.navigate('Search')}
              accessibilityLabel='See all urgent offers'
            >
              See All
            </Button>
          </View>

          {Boolean(isUrgentLoading) && (
            <FlatList
              data={[1, 2, 3]}
              renderItem={() => (
                <SkeletonOfferCard imageAspectRatio={1.4} style={styles.offerCardItem} />
              )}
              keyExtractor={item => `skeleton-urgent-${item}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              scrollEnabled={false}
            />
          )}

          {Boolean(urgentError) && !Boolean(isUrgentLoading) && urgentOffers === undefined && (
            <Card style={styles.placeholderCard}>
              <Text variant='body' size='md' color='error' align='center'>
                ⚠️ Failed to load urgent deals
              </Text>
              <Button
                variant='outline'
                size='sm'
                onPress={() => void refetchUrgent()}
                style={styles.retryButton}
              >
                Retry
              </Button>
            </Card>
          )}

          {!isUrgentLoading && !urgentError && urgentOffers && urgentOffers.length > 0 && (
            <FlatList
              data={urgentOffers}
              renderItem={({ item }) => (
                <FavoriteOfferCard
                  offer={item}
                  variant='featured'
                  imageAspectRatio={1.4}
                  onPress={offer => navigation.navigate('OfferDetails', { offerId: offer.id })}
                  testID={`urgent-offer-${item.id}`}
                  style={styles.offerCardItem}
                />
              )}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              snapToInterval={300}
              decelerationRate='fast'
              accessibilityLabel='Urgent offers carousel'
              accessibilityHint='Swipe left or right to browse offers expiring within 1 hour'
            />
          )}

          {!Boolean(isUrgentLoading) &&
            !Boolean(urgentError) &&
            (!urgentOffers || urgentOffers.length === 0) && (
              <Card style={styles.placeholderCard}>
                <Text variant='body' size='md' color='secondary' align='center'>
                  No urgent deals right now
                </Text>
                <Text
                  variant='body'
                  size='sm'
                  color='secondary'
                  align='center'
                  style={styles.placeholderSubtext}
                >
                  Offers expiring within 1 hour will appear here
                </Text>
              </Card>
            )}
        </View>

        {/* Hottest Deals Section (70%+ Discount) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant='title' size='lg' weight='semibold'>
              Hottest Deals 🔥
            </Text>
            <Button
              variant='ghost'
              size='sm'
              onPress={() => navigation.navigate('Search')}
              accessibilityLabel='See all hot deals'
            >
              See All
            </Button>
          </View>

          {isHottestLoading && (
            <FlatList
              data={[1, 2, 3]}
              renderItem={() => (
                <SkeletonOfferCard imageAspectRatio={1.4} style={styles.offerCardItem} />
              )}
              keyExtractor={item => `skeleton-hottest-${item}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              scrollEnabled={false}
            />
          )}

          {hottestError && !isHottestLoading && hottestDeals?.data === undefined && (
            <Card style={styles.placeholderCard}>
              <Text variant='body' size='md' color='error' align='center'>
                ⚠️ Failed to load hottest deals
              </Text>
              <Button
                variant='outline'
                size='sm'
                onPress={() => void refetchHottest()}
                style={styles.retryButton}
              >
                Retry
              </Button>
            </Card>
          )}

          {!isHottestLoading &&
            !hottestError &&
            hottestDeals?.data &&
            hottestDeals.data.length > 0 && (
              <FlatList
                data={hottestDeals.data}
                renderItem={({ item }) => (
                  <FavoriteOfferCard
                    offer={item}
                    variant='default'
                    imageAspectRatio={1.4}
                    onPress={offer => navigation.navigate('OfferDetails', { offerId: offer.id })}
                    testID={`hottest-offer-${item.id}`}
                    style={styles.offerCardItem}
                  />
                )}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContainer}
                snapToInterval={300}
                decelerationRate='fast'
                accessibilityLabel='Hottest deals carousel'
                accessibilityHint='Swipe left or right to browse biggest discounts'
              />
            )}

          {!isHottestLoading &&
            !hottestError &&
            (!hottestDeals?.data || hottestDeals.data.length === 0) && (
              <Card style={styles.placeholderCard}>
                <Text variant='body' size='md' color='secondary' align='center'>
                  No hottest deals for now
                </Text>
                <Text
                  variant='body'
                  size='sm'
                  color='secondary'
                  align='center'
                  style={styles.placeholderSubtext}
                >
                  Check back soon for offers with 70%+ discount
                </Text>
              </Card>
            )}
        </View>

        {/* Pickup Today Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant='title' size='lg' weight='semibold'>
              Pickup Today 📅
            </Text>
            <Button
              variant='ghost'
              size='sm'
              onPress={() => navigation.navigate('Search')}
              accessibilityLabel='See all pickup today offers'
            >
              See All
            </Button>
          </View>

          {Boolean(isPickupTodayLoading) && (
            <FlatList
              data={[1, 2, 3]}
              renderItem={() => (
                <SkeletonOfferCard imageAspectRatio={1.4} style={styles.offerCardItem} />
              )}
              keyExtractor={item => `skeleton-pickup-today-${item}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              scrollEnabled={false}
            />
          )}

          {Boolean(pickupTodayError) &&
            !Boolean(isPickupTodayLoading) &&
            pickupTodayOffers === undefined && (
              <Card style={styles.placeholderCard}>
                <Text variant='body' size='md' color='error' align='center'>
                  ⚠️ Failed to load pickup today offers
                </Text>
                <Button
                  variant='outline'
                  size='sm'
                  onPress={() => void refetchPickupToday()}
                  style={styles.retryButton}
                >
                  Retry
                </Button>
              </Card>
            )}

          {!Boolean(isPickupTodayLoading) &&
            !Boolean(pickupTodayError) &&
            pickupTodayOffers &&
            pickupTodayOffers.length > 0 && (
              <FlatList
                data={pickupTodayOffers}
                renderItem={({ item }) => (
                  <FavoriteOfferCard
                    offer={item}
                    variant='default'
                    imageAspectRatio={1.4}
                    onPress={offer => navigation.navigate('OfferDetails', { offerId: offer.id })}
                    testID={`pickup-today-offer-${item.id}`}
                    style={styles.offerCardItem}
                  />
                )}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContainer}
                snapToInterval={300}
                decelerationRate='fast'
                accessibilityLabel='Pickup today offers carousel'
                accessibilityHint='Swipe left or right to browse pickup today offers'
              />
            )}

          {!isPickupTodayLoading &&
            !pickupTodayError &&
            (!pickupTodayOffers || pickupTodayOffers.length === 0) && (
              <Card style={styles.placeholderCard}>
                <Text variant='body' size='md' color='secondary' align='center'>
                  No offers available for pickup today
                </Text>
                <Text
                  variant='body'
                  size='sm'
                  color='secondary'
                  align='center'
                  style={styles.placeholderSubtext}
                >
                  Check back later or browse other offers
                </Text>
              </Card>
            )}
        </View>

        {/* Pickup Tomorrow Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant='title' size='lg' weight='semibold'>
              Pickup Tomorrow 📅
            </Text>
            <Button
              variant='ghost'
              size='sm'
              onPress={() => navigation.navigate('Search')}
              accessibilityLabel='See all pickup tomorrow offers'
            >
              See All
            </Button>
          </View>

          {isPickupTomorrowLoading && (
            <FlatList
              data={[1, 2, 3]}
              renderItem={() => (
                <SkeletonOfferCard imageAspectRatio={1.4} style={styles.offerCardItem} />
              )}
              keyExtractor={item => `skeleton-pickup-tomorrow-${item}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              scrollEnabled={false}
            />
          )}

          {pickupTomorrowError &&
            !isPickupTomorrowLoading &&
            pickupTomorrowOffers === undefined && (
              <Card style={styles.placeholderCard}>
                <Text variant='body' size='md' color='error' align='center'>
                  ⚠️ Failed to load pickup tomorrow offers
                </Text>
                <Button
                  variant='outline'
                  size='sm'
                  onPress={() => void refetchPickupTomorrow()}
                  style={styles.retryButton}
                >
                  Retry
                </Button>
              </Card>
            )}

          {!isPickupTomorrowLoading &&
            !pickupTomorrowError &&
            pickupTomorrowOffers &&
            pickupTomorrowOffers.length > 0 && (
              <FlatList
                data={pickupTomorrowOffers}
                renderItem={({ item }) => (
                  <FavoriteOfferCard
                    offer={item}
                    variant='default'
                    imageAspectRatio={1.4}
                    onPress={offer => navigation.navigate('OfferDetails', { offerId: offer.id })}
                    testID={`pickup-tomorrow-offer-${item.id}`}
                    style={styles.offerCardItem}
                  />
                )}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContainer}
                snapToInterval={300}
                decelerationRate='fast'
                accessibilityLabel='Pickup tomorrow offers carousel'
                accessibilityHint='Swipe left or right to browse pickup tomorrow offers'
              />
            )}

          {!isPickupTomorrowLoading &&
            !pickupTomorrowError &&
            (!pickupTomorrowOffers || pickupTomorrowOffers.length === 0) && (
              <Card style={styles.placeholderCard}>
                <Text variant='body' size='md' color='secondary' align='center'>
                  No offers available for pickup tomorrow
                </Text>
                <Text
                  variant='body'
                  size='sm'
                  color='secondary'
                  align='center'
                  style={styles.placeholderSubtext}
                >
                  Check back later or browse other offers
                </Text>
              </Card>
            )}
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <Text variant='title' size='lg' weight='semibold' style={styles.sectionTitle}>
            Browse by Category
          </Text>

          <View style={styles.categoriesGrid}>
            {['Bakery', 'Restaurant', 'Grocery', 'Cafe'].map(category => (
              <TouchableOpacity
                key={category}
                onPress={() => handleCategoryPress(category)}
                accessibilityRole='button'
                accessibilityLabel={`${category} category`}
                accessibilityHint={`Browse ${category.toLowerCase()} offers`}
              >
                <Card style={styles.categoryCard}>
                  <Text variant='body' size='sm' weight='medium' align='center'>
                    {category}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Impact Stats Section */}
        <Card style={styles.impactCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
            Your Impact
          </Text>
          <View style={styles.statsGrid}>
            <View
              style={styles.statItem}
              accessibilityLabel='Meals saved: 0'
              accessibilityHint='Total number of meals you have saved from waste'
            >
              <Text variant='headline' size='lg' weight='bold' color='primary'>
                0
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                Meals Saved
              </Text>
            </View>
            <View
              style={styles.statItem}
              accessibilityLabel='Money saved: $0'
              accessibilityHint='Total amount of money you have saved'
            >
              <Text variant='headline' size='lg' weight='bold' color='success'>
                $0
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                Money Saved
              </Text>
            </View>
            <View
              style={styles.statItem}
              accessibilityLabel='CO2 reduced: 0 kilograms'
              accessibilityHint='Carbon dioxide emissions prevented by saving food'
            >
              <Text
                variant='headline'
                size='lg'
                weight='bold'
                style={{ color: theme.colors.warning }}
              >
                0kg
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                CO₂ Reduced
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Location Selection Modal - First time setup */}
      <LocationSelectionModal
        visible={showLocationSelectionModal}
        onLocationSelect={(coordinates, name) => {
          void handleLocationSelection(coordinates, name);
        }}
        isLoading={isLocationLoading}
        error={locationError}
        testID='location-selection-modal'
      />

      {/* Manual Location Modal - Fallback when GPS permission denied */}
      <ManualLocationModal
        visible={showManualLocationModal}
        onClose={() => setShowManualLocationModal(false)}
        onLocationSelect={handleManualLocationSelect}
        testID='manual-location-modal'
      />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        visible={isFilterVisible}
        filters={filters}
        onClose={() => setIsFilterVisible(false)}
        onApply={handleApplyFilters}
        onClear={handleClearAllFilters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  placeholderCard: {
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  placeholderSubtext: {
    marginTop: 8,
  },
  carouselContainer: {
    paddingLeft: 14,
    paddingRight: 18,
    paddingVertical: 12,
  },
  offerCardItem: {
    marginRight: 3,
    marginVertical: 3,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 10,
  },
  categoryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    alignItems: 'center',
  },
  impactCard: {
    padding: 20,
    marginHorizontal: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 12,
  },
  bannerWrapper: {
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.WHITE,
  },
  filterBadgeText: {
    color: COLORS.WHITE,
    fontSize: 11,
    fontWeight: '600',
  },
});
