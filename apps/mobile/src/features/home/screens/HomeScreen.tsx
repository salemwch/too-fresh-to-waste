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

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { LocationPromptBanner } from '@/design-system/components/molecules';
import { ManualLocationModal } from '@/design-system/components/organisms';
import { useTheme } from '@/design-system/providers';
import { ImpactBanner } from '@/features/donations';
import { OfferCard } from '@/features/offers/components';
import { useFeaturedOffers } from '@/features/offers/hooks/useOffers';
import { useAppSelector } from '@/hooks/redux';
import { useLocation } from '@/hooks/useLocation';

import type { HomeScreenNavigationProp } from '@/navigation/types';
import type { OfferListItem } from '@/features/offers/types/offer.types';

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { user } = useAppSelector(state => state.auth);

  // Featured offers query
  const {
    data: featuredOffers,
    isLoading: isFeaturedLoading,
    error: featuredError,
    refetch: refetchFeatured
  } = useFeaturedOffers(10);

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

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [showManualLocationModal, setShowManualLocationModal] = useState(false);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchFeatured();
    // TODO: Refetch nearby offers when implemented
    setRefreshing(false);
  }, [refetchFeatured]);

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
   */
  const handleViewNearbyOffers = useCallback(async () => {
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
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            accessibilityLabel={refreshing ? 'Refreshing offers' : 'Pull to refresh'}
          />
        }
      >
        {/* Location Prompt Banner - Show when user hasn't enabled location */}
        {shouldShowPrompt && (
          <LocationPromptBanner
            onEnable={handleEnableLocation}
            onDismiss={dismissLocationPrompt}
            isLoading={isLocationLoading}
            testID="location-prompt-banner"
          />
        )}

        {/* 🌍 Community Donation Impact Banner */}
        <ImpactBanner
          onExpand={() => {
            // TODO: Track analytics when user expands the banner
            // analytics.track('community_impact_banner_expanded');
          }}
        />

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text variant='headline' size='xl' weight='bold'>
            Welcome back
            {user?.firstName != null && user.firstName !== '' ? `, ${user.firstName}` : ''}!
          </Text>
          <Text variant='body' size='md' color='secondary' style={styles.subtitle}>
            Discover great deals on surplus food nearby
          </Text>
        </View>

        {/* Featured Offers Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant='title' size='lg' weight='semibold'>
              Featured Offers
            </Text>
            <Button
              variant='ghost'
              size='sm'
              onPress={() => navigation.navigate('Search')}
              accessibilityLabel='See all featured offers'
              accessibilityHint='Opens search screen with all available offers'
            >
              See All
            </Button>
          </View>

          {/* Loading State */}
          {isFeaturedLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text variant="body" size="sm" color="secondary" style={{ marginTop: 12 }}>
                Loading featured offers...
              </Text>
            </View>
          )}

          {/* Error State */}
          {featuredError && !isFeaturedLoading && (
            <Card style={styles.placeholderCard}>
              <Text variant="body" size="md" color="error" align="center">
                ⚠️ Failed to load featured offers
              </Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => refetchFeatured()}
                style={{ marginTop: 12 }}
              >
                Retry
              </Button>
            </Card>
          )}

          {/* Featured Offers Carousel */}
          {!isFeaturedLoading && !featuredError && featuredOffers && featuredOffers.length > 0 && (
            <FlatList
              data={featuredOffers}
              renderItem={({ item }) => (
                <OfferCard offer={item} variant="carousel" testID={`featured-offer-${item._id}`} />
              )}
              keyExtractor={(item) => item._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              snapToInterval={300} // Snap to card width
              decelerationRate="fast"
              accessibilityLabel="Featured offers carousel"
              accessibilityHint="Swipe left or right to browse featured offers"
            />
          )}

          {/* Empty State */}
          {!isFeaturedLoading && !featuredError && (!featuredOffers || featuredOffers.length === 0) && (
            <Card style={styles.placeholderCard}>
              <Text variant='body' size='md' color='secondary' align='center'>
                No featured offers available
              </Text>
              <Text
                variant='body'
                size='sm'
                color='secondary'
                align='center'
                style={styles.placeholderSubtext}
              >
                Check back soon for amazing deals from local businesses
              </Text>
            </Card>
          )}
        </View>

        {/* Nearby Offers Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant='title' size='lg' weight='semibold'>
              Nearby Offers
            </Text>
            <Button
              variant='ghost'
              size='sm'
              onPress={handleViewNearbyOffers}
              accessibilityLabel='View nearby offers on map'
              accessibilityHint='Opens map view showing food offers near your location'
            >
              View Map
            </Button>
          </View>

          <Card style={styles.placeholderCard}>
            <Text variant='body' size='md' color='secondary' align='center'>
              Nearby offers will appear here
            </Text>
            <Text
              variant='body'
              size='sm'
              color='secondary'
              align='center'
              style={styles.placeholderSubtext}
            >
              Save food and money from restaurants near you
            </Text>
          </Card>
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

      {/* Manual Location Modal - Fallback when GPS permission denied */}
      <ManualLocationModal
        visible={showManualLocationModal}
        onClose={() => setShowManualLocationModal(false)}
        onLocationSelect={handleManualLocationSelect}
        testID="manual-location-modal"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  subtitle: {
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  placeholderCard: {
    padding: 32,
    alignItems: 'center',
  },
  placeholderSubtext: {
    marginTop: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselContainer: {
    paddingLeft: 4,
    paddingRight: 8,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    alignItems: 'center',
  },
  impactCard: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
});
