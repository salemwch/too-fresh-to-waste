/**
 * Favorites Screen - Luxury Premium Design
 * Display user's saved/favorited offers with category filtering
 *
 * 🎨 PREMIUM UI/UX FEATURES:
 * - Luxury gradient header
 * - Category filter chips with icons (one-line horizontal scroll)
 * - Clean 2-column grid layout
 * - Smooth animations and transitions
 * - Pull-to-refresh with haptic feedback
 * - Premium empty state
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Button, Card, Icon } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';

import { FavoriteOfferCard, DeletedOfferCard } from '../components';
import { useFavoritesInfinite } from '../hooks';
import { favoritesService } from '../services';
import { FavoriteType } from '../types';

import type { FavoritesScreenNavigationProp } from '@/navigation/types';

interface FavoritesScreenProps {
  navigation: FavoritesScreenNavigationProp;
}

// ============================================================================
// Category Filter Configuration
// ============================================================================

interface CategoryFilter {
  id: string;
  label: string;
  icon: string;
  iconFamily: 'Ionicons';
  establishmentType?: string;
}

const CATEGORY_FILTERS: CategoryFilter[] = [
  { id: 'all', label: 'All', icon: 'apps-outline', iconFamily: 'Ionicons' },
  {
    id: 'restaurant',
    label: 'Restaurant',
    icon: 'restaurant-outline',
    iconFamily: 'Ionicons',
    establishmentType: 'restaurant',
  },
  {
    id: 'bakery',
    label: 'Bakery',
    icon: 'cafe-outline',
    iconFamily: 'Ionicons',
    establishmentType: 'bakery',
  },
  {
    id: 'grocery_store',
    label: 'Grocery',
    icon: 'cart-outline',
    iconFamily: 'Ionicons',
    establishmentType: 'grocery_store',
  },
  {
    id: 'cafe',
    label: 'Cafe',
    icon: 'wine-outline',
    iconFamily: 'Ionicons',
    establishmentType: 'cafe',
  },
  {
    id: 'fast_food',
    label: 'Fast Food',
    icon: 'fast-food-outline',
    iconFamily: 'Ionicons',
    establishmentType: 'fast_food',
  },
  {
    id: 'supermarket',
    label: 'Supermarket',
    icon: 'storefront-outline',
    iconFamily: 'Ionicons',
    establishmentType: 'supermarket',
  },
  {
    id: 'hotel',
    label: 'Hotel',
    icon: 'bed-outline',
    iconFamily: 'Ionicons',
    establishmentType: 'hotel',
  },
];

// ============================================================================
// Main Component
// ============================================================================

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const theme = useTheme();

  // State
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [establishmentType, setEstablishmentType] = useState<string | undefined>(undefined);

  // ✅ Infinite scroll hook for favorites
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useFavoritesInfinite({
      isActive: true,
      establishmentType,
    });

  // Flatten pages into single array
  const favorites = React.useMemo(() => {
    return data?.pages.flatMap(page => page.favorites) ?? [];
  }, [data]);

  const [refreshing, setRefreshing] = useState(false);

  /**
   * Refetch favorites when screen comes into focus
   * ✅ BEST PRACTICE: Ensures user sees newly added favorites
   */
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  /**
   * Navigate to search to find offers
   */
  const handleBrowseOffers = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  /**
   * Handle offer card press
   */
  const handleOfferPress = useCallback(
    (offer: any) => {
      // ✅ Backend DTO uses 'id' (string), raw documents have '_id' (ObjectId)
      const offerId = offer.id || offer._id?.toString() || offer._id;

      if (!offerId) {
        console.error('❌ Cannot navigate - offer has no ID:', offer);
        return;
      }

      console.log('📍 Navigating to OfferDetails:', { offerId, offerTitle: offer.title });
      navigation.navigate('OfferDetails', { offerId });
    },
    [navigation],
  );

  /**
   * Handle load more (infinite scroll)
   */
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Handle remove deleted favorite
   */
  const handleRemoveDeletedFavorite = useCallback(async (favoriteId: string) => {
    try {
      await favoritesService.removeFavorite(favoriteId);
      refetch(); // Refresh the list
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  }, [refetch]);

  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((filterId: string) => {
    setSelectedFilter(filterId);
    const filter = CATEGORY_FILTERS.find(f => f.id === filterId);
    setEstablishmentType(filter?.establishmentType);
  }, []);

  /**
   * Render a favorite item — extracted from inline renderItem for FlatList performance.
   * Avoids creating a new function reference on every render cycle.
   */
  const renderFavoriteItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === FavoriteType.OFFER) {
        if (typeof item.itemId === 'object' && item.itemId !== null) {
          const offer = item.itemId as any;
          return (
            <FavoriteOfferCard
              offer={offer}
              variant="default"
              imageAspectRatio={16 / 9}
              onPress={offer => handleOfferPress(offer)}
              style={styles.favoriteCard}
              testID={`favorite-offer-${offer.id}`}
            />
          );
        } else {
          return (
            <DeletedOfferCard
              onRemove={() => handleRemoveDeletedFavorite(item._id)}
              style={styles.favoriteCard}
            />
          );
        }
      }
      return null;
    },
    [handleOfferPress, handleRemoveDeletedFavorite],
  );

  /**
   * Render footer loading indicator — extracted for stable reference.
   */
  const renderListFooter = useCallback(
    () =>
      isFetchingNextPage ? (
        <View style={styles.loadingMore}>
          <SkeletonOfferCard imageAspectRatio={16 / 9} style={styles.skeletonCard} />
          <SkeletonOfferCard imageAspectRatio={16 / 9} style={styles.skeletonCard} />
        </View>
      ) : null,
    [isFetchingNextPage],
  );

  // Check if we have favorites
  const hasFavorites = favorites.length > 0;

  // ============================================================================
  // Render Filter Chip
  // ============================================================================

  const renderFilterChip = (filter: CategoryFilter) => {
    const isSelected = selectedFilter === filter.id;

    return (
      <Pressable
        key={filter.id}
        style={[
          styles.filterChip,
          isSelected && styles.filterChipActive,
        ]}
        onPress={() => handleFilterChange(filter.id)}
      >
        <Icon
          name={filter.icon}
          family={filter.iconFamily}
          size={18}
          color={isSelected ? '#FFFFFF' : '#64748B'}
        />
        <Text
          style={[
            styles.filterChipText,
            isSelected && styles.filterChipTextActive,
          ]}
        >
          {filter.label}
        </Text>
      </Pressable>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#005250"
            colors={['#005250']}
          />
        }
      >
        {/* Category Filter Chips - One Line Horizontal Scroll */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {CATEGORY_FILTERS.map(filter => renderFilterChip(filter))}
          </ScrollView>
        </View>

        {/* Loading State */}
        {isLoading && !refreshing && (
          <View style={styles.listContainer}>
            <SkeletonOfferCard imageAspectRatio={16/9} style={styles.skeletonCard} />
            <SkeletonOfferCard imageAspectRatio={16/9} style={styles.skeletonCard} />
            <SkeletonOfferCard imageAspectRatio={16/9} style={styles.skeletonCard} />
          </View>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card style={styles.errorCard}>
            <Icon name="alert-circle-outline" family="Ionicons" size={48} color="#EF4444" />
            <Text
              variant="title"
              size="md"
              weight="semibold"
              style={styles.errorTitle}
            >
              Failed to Load Favorites
            </Text>
            <Text
              variant="body"
              size="sm"
              style={styles.errorSubtext}
            >
              {error instanceof Error ? error.message : 'An error occurred'}
            </Text>
            <Button variant="primary" size="md" onPress={() => refetch()}>
              Try Again
            </Button>
          </Card>
        )}

        {/* Empty State - Premium Design */}
        {!isLoading && !error && !hasFavorites && (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#F0FDF4', '#DCFCE7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconContainer}
            >
              <Icon name="heart-outline" family="Ionicons" size={64} color="#10B981" />
            </LinearGradient>

            <Text style={styles.emptyTitle}>No Favorites Yet</Text>

            <Text style={styles.emptyDescription}>
              Save your favorite offers to quickly access them later. Tap the heart icon on any
              offer to add it here.
            </Text>

            <Pressable style={styles.browseButton} onPress={handleBrowseOffers}>
              <Icon name="search-outline" family="Ionicons" size={20} color="#FFFFFF" />
              <Text style={styles.browseButtonText}>Browse Offers</Text>
            </Pressable>

            {/* Pro Tip Card */}
            <View style={styles.tipCard}>
              <View style={styles.tipIconContainer}>
                <Icon name="bulb-outline" family="Ionicons" size={20} color="#F59E0B" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Pro Tip</Text>
                <Text style={styles.tipText}>
                  Favorite offers you want to order from regularly to stay notified of new deals
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Favorites List - Vertical Scroll (One Below Another) */}
        {!isLoading && !error && hasFavorites && (
          <View style={styles.favoritesSection}>
            <FlatList
              data={favorites}
              renderItem={renderFavoriteItem}
              keyExtractor={item => item._id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderListFooter}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ============================================================================
// Styles - Luxury Premium Design
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  // Category Filter Chips Section
  filterSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  filterChipActive: {
    backgroundColor: '#005250',
    borderColor: '#005250',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // Empty State - Premium
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005250',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#005250',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  // Favorites List - Vertical (One Below Another)
  favoritesSection: {
    paddingHorizontal: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  favoriteCard: {
    marginBottom: 16,
  },
  skeletonCard: {
    marginBottom: 16,
  },
  loadingMore: {
    paddingTop: 8,
  },

  // Error State
  errorCard: {
    marginHorizontal: 16,
    marginTop: 32,
    padding: 24,
    alignItems: 'center',
    borderRadius: 16,
  },
  errorTitle: {
    marginTop: 12,
    color: '#1F2937',
  },
  errorSubtext: {
    marginTop: 8,
    marginBottom: 16,
    color: '#64748B',
  },
});
