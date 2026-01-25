/**
 * Favorites Screen
 * Display user's saved/favorited offers
 *
 * Features:
 * - Grid layout of favorite offers
 * - Pull-to-refresh
 * - Filter by type (offers, establishments)
 * - Empty state with call-to-action
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
} from 'react-native';

import { Text, Button, Card, Icon } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { FavoriteOfferCard } from '../components';
import { useFavoritesList, useFavoritesStats } from '../hooks';
import { FavoriteType } from '../types';

import type { FavoritesScreenNavigationProp } from '@/navigation/types';

interface FavoritesScreenProps {
  navigation: FavoritesScreenNavigationProp;
}

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const theme = useTheme();

  // State
  const [filterType, setFilterType] = useState<FavoriteType | undefined>(undefined);

  // Fetch favorites
  const {
    data: favoritesData,
    isLoading,
    error,
    refetch,
  } = useFavoritesList({
    type: filterType ?? undefined,
    isActive: true,
    page: 1,
    limit: 50,
    sortBy: '-addedAt',
  });

  // Fetch stats
  const { data: stats } = useFavoritesStats();

  const [refreshing, setRefreshing] = useState(false);

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
    (offerId: string) => {
      navigation.navigate('OfferDetails', { offerId });
    },
    [navigation],
  );

  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((type: FavoriteType | undefined) => {
    setFilterType(type);
  }, []);

  // Check if we have favorites (with safety checks)
  const hasFavorites = favoritesData && Array.isArray(favoritesData.favorites) && favoritesData.favorites.length > 0;
  const totalFavorites = stats?.totalFavorites ?? 0;
  const favorites = favoritesData?.favorites ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Loading State */}
        {isLoading && !refreshing && (
          <View style={styles.gridContainer}>
            <SkeletonOfferCard imageAspectRatio={1.4} />
            <SkeletonOfferCard imageAspectRatio={1.4} />
            <SkeletonOfferCard imageAspectRatio={1.4} />
          </View>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card style={styles.errorCard}>
            <Icon name='alert-circle-outline' family='Ionicons' size={48} color={theme.colors.error} />
            <Text variant='title' size='md' weight='semibold' style={{ marginTop: 12 }}>
              Failed to Load Favorites
            </Text>
            <Text variant='body' size='sm' color='secondary' style={{ marginTop: 8, marginBottom: 16 }}>
              {error instanceof Error ? error.message : 'An error occurred'}
            </Text>
            <Button variant='primary' size='md' onPress={() => refetch()}>
              Try Again
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && !hasFavorites && (
          <View style={styles.emptyState}>
            <View
              style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceContainer }]}
            >
              <Icon
                name='heart-outline'
                family='Ionicons'
                size={64}
                color={theme.colors.onSurfaceVariant}
              />
            </View>

            <Text variant='headline' size='lg' weight='semibold' align='center'>
              No Favorites Yet
            </Text>

            <Text
              variant='body'
              size='md'
              color='secondary'
              align='center'
              style={styles.emptyStateDescription}
            >
              Save your favorite offers to quickly access them later. Tap the heart icon on any
              offer to add it here.
            </Text>

            <Button
              variant='primary'
              size='lg'
              onPress={handleBrowseOffers}
              leftIcon='search-outline'
              leftIconFamily='Ionicons'
              style={styles.browseButton}
            >
              Browse Offers
            </Button>

            {/* Tips Card */}
            <Card style={styles.tipsCard}>
              <View style={styles.tipItem}>
                <Icon
                  name='bulb-outline'
                  family='Ionicons'
                  size={24}
                  color={theme.colors.warning}
                />
                <View style={styles.tipContent}>
                  <Text variant='body' size='sm' weight='medium'>
                    Pro Tip
                  </Text>
                  <Text variant='body' size='sm' color='secondary'>
                    Favorite offers you want to order from regularly to stay notified of new deals
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Favorites List */}
        {!isLoading && !error && hasFavorites && (
          <View style={styles.favoritesSection}>
            <View style={styles.header}>
              <Text variant='title' size='lg' weight='semibold'>
                My Favorites
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                {totalFavorites} saved {totalFavorites === 1 ? 'offer' : 'offers'}
              </Text>
            </View>

            {/* Filter Options */}
            <View style={styles.filterSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContent}
              >
                <Button
                  variant={filterType === undefined ? 'outline' : 'ghost'}
                  size='sm'
                  style={styles.filterButton}
                  onPress={() => handleFilterChange(undefined)}
                >
                  All
                </Button>
                <Button
                  variant={filterType === FavoriteType.OFFER ? 'outline' : 'ghost'}
                  size='sm'
                  style={styles.filterButton}
                  onPress={() => handleFilterChange(FavoriteType.OFFER)}
                >
                  Offers
                </Button>
                <Button
                  variant={filterType === FavoriteType.ESTABLISHMENT ? 'outline' : 'ghost'}
                  size='sm'
                  style={styles.filterButton}
                  onPress={() => handleFilterChange(FavoriteType.ESTABLISHMENT)}
                >
                  Establishments
                </Button>
              </ScrollView>
            </View>

            {/* Favorites Grid */}
            <FlatList
              data={favoritesData?.favorites ?? []}
              renderItem={({ item }) => {
                // Only render offer type favorites (establishments would need different card)
                if (item.type === FavoriteType.OFFER && typeof item.itemId === 'object') {
                  return (
                    <FavoriteOfferCard
                      offer={item.itemId as any} // Populated offer data
                      variant='default'
                      imageAspectRatio={1.4}
                      onPress={(offer) => handleOfferPress(offer.id)}
                      style={styles.favoriteCard}
                    />
                  );
                }
                return null;
              }}
              keyExtractor={(item) => item._id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gridContainer}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  errorCard: {
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  iconContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateDescription: {
    marginTop: 12,
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  browseButton: {
    minWidth: 200,
    marginBottom: 32,
  },
  tipsCard: {
    padding: 16,
    width: '100%',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  favoritesSection: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
  },
  filterButton: {
    marginRight: 0,
  },
  gridContainer: {
    paddingBottom: 16,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  favoriteCard: {
    flex: 1,
    marginHorizontal: 4,
  },
});
