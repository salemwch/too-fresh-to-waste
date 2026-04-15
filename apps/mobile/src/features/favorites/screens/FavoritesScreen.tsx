/**
 * Favorites Screen
 * Display user's saved offers with category filtering
 */

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { usePrefetchOffer } from '@/features/offers/hooks/useOffers';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Button, Card, Icon } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';
import { CtaState, OfferStatus } from '@/features/offers/types';
import { Logger } from '@/utils/logger';

import { DeletedOfferCard, FavoriteOfferCard } from '../components';
import { useFavoritesInfinite } from '../hooks';
import { favoritesService } from '../services';
import { FavoriteType } from '../types';

import type { FavoritesResponse } from '../types';
import type { Offer, OfferListItem } from '@/features/offers/types';
import type { FavoritesScreenNavigationProp } from '@/navigation/types';

interface FavoritesScreenProps {
  navigation: FavoritesScreenNavigationProp;
}

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

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandSoftStart: '#F0FDF4',
  brandSoftEnd: '#DCFCE7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  surface: '#FFFFFF',
  surfaceAccent: '#FEF3C7',
  border: '#E2E8F0',
  textPrimary: '#1F2937',
  textSecondary: '#64748B',
  textInverse: '#FFFFFF',
  shadow: '#000',
} as const;

type FavoriteListItem = FavoritesResponse['favorites'][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const isOfferListItem = (value: unknown): value is OfferListItem =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  isRecord(value['pricing']) &&
  isRecord(value['establishment']) &&
  typeof value['establishment']['name'] === 'string';

const isOfferDocument = (value: unknown): value is Offer =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['title'] === 'string' &&
  isRecord(value['pricing']) &&
  Array.isArray(value['images']);

const getOfferNavigationId = (offer: Offer | OfferListItem): string | undefined =>
  offer.id !== '' ? offer.id : offer._id;

const toOfferListItem = (offer: Offer | OfferListItem): OfferListItem => {
  if (isOfferListItem(offer)) {
    return offer;
  }

  const availableQuantity =
    offer.availableQuantity ??
    Math.max(0, offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity);
  const establishment =
    typeof offer.establishmentId === 'object' ? offer.establishmentId : undefined;
  const merchant = typeof offer.merchantId === 'object' ? offer.merchantId : undefined;
  const now = new Date();
  const hasNotStarted = new Date(offer.availableFrom) > now;

  let ctaState = CtaState.AVAILABLE;
  if (
    offer.status === OfferStatus.EXPIRED ||
    offer.status === OfferStatus.SOLD_OUT ||
    availableQuantity <= 0
  ) {
    ctaState = CtaState.SOLD_OUT;
  } else if (hasNotStarted) {
    ctaState = CtaState.NOT_STARTED;
  } else if (availableQuantity < 5) {
    ctaState = CtaState.LOW_STOCK;
  }

  return {
    id: offer.id,
    ...(offer._id !== undefined && { _id: offer._id }),
    title: offer.title,
    type: offer.type,
    image: offer.images[0],
    pricing: offer.pricing,
    availableQuantity,
    availableFrom: offer.availableFrom,
    availableUntil: offer.availableUntil,
    pickupTimeSlots: offer.pickupTimeSlots?.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    establishment: {
      name: establishment?.name ?? 'Establishment',
      ...(establishment?.averageRating !== undefined && {
        averageRating: establishment.averageRating,
      }),
      ...(establishment?.totalReviews !== undefined && {
        totalReviews: establishment.totalReviews,
      }),
      ...(merchant?.profileImage !== undefined &&
        merchant.profileImage !== null &&
        merchant.profileImage !== '' && {
          profileImage: merchant.profileImage,
        }),
    },
    categories: offer.categories,
    status: offer.status,
    ctaState,
  };
};

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const prefetchOffer = usePrefetchOffer();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [establishmentType, setEstablishmentType] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useFavoritesInfinite({
      isActive: true,
      establishmentType,
    });

  const favorites = useMemo(() => data?.pages.flatMap(page => page.favorites) ?? [], [data]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => {
      setRefreshing(false);
    });
  }, [refetch]);

  const handleBrowseOffers = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleOfferPress = useCallback(
    (offer: Offer | OfferListItem) => {
      const offerId = getOfferNavigationId(offer);

      if (offerId === undefined || offerId === '') {
        Logger.warn('[FavoritesScreen] Cannot navigate - offer has no ID', {
          offerTitle: offer.title,
        });
        return;
      }

      Logger.debug('[FavoritesScreen] Navigating to OfferDetails', {
        offerId,
        offerTitle: offer.title,
      });
      prefetchOffer(offerId);
      navigation.navigate('OfferDetails', { offerId });
    },
    [navigation, prefetchOffer],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleRemoveDeletedFavorite = useCallback(
    (favoriteId: string) => {
      void (async () => {
        try {
          await favoritesService.removeFavorite(favoriteId);
          void refetch();
        } catch (removeError) {
          Logger.error(
            '[FavoritesScreen] Failed to remove deleted favorite',
            { favoriteId },
            removeError as Error,
          );
        }
      })();
    },
    [refetch],
  );

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleFilterChange = useCallback((filterId: string) => {
    setSelectedFilter(filterId);
    const filter = CATEGORY_FILTERS.find(item => item.id === filterId);
    setEstablishmentType(filter?.establishmentType);
  }, []);

  const renderFavoriteItem = useCallback(
    ({ item }: { item: FavoriteListItem }) => {
      if (item.type === FavoriteType.OFFER) {
        if (isOfferListItem(item.itemId) || isOfferDocument(item.itemId)) {
          const offer = toOfferListItem(item.itemId);

          return (
            <FavoriteOfferCard
              offer={offer}
              variant='default'
              imageAspectRatio={16 / 9}
              onPress={handleOfferPress}
              style={styles.favoriteCard}
              testID={`favorite-offer-${offer.id}`}
            />
          );
        }

        return (
          <DeletedOfferCard
            onRemove={() => handleRemoveDeletedFavorite(item._id)}
            style={styles.favoriteCard}
          />
        );
      }

      return null;
    },
    [handleOfferPress, handleRemoveDeletedFavorite],
  );

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

  const hasFavorites = favorites.length > 0;

  const renderFilterChip = (filter: CategoryFilter) => {
    const isSelected = selectedFilter === filter.id;

    return (
      <Pressable
        key={filter.id}
        style={[styles.filterChip, isSelected && styles.filterChipActive]}
        onPress={() => handleFilterChange(filter.id)}
      >
        <Icon
          name={filter.icon}
          family={filter.iconFamily}
          size={18}
          color={isSelected ? COLORS.textInverse : COLORS.textSecondary}
        />
        <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
          {filter.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brand}
            colors={[COLORS.brand]}
          />
        }
      >
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {CATEGORY_FILTERS.map(filter => renderFilterChip(filter))}
          </ScrollView>
        </View>

        {isLoading && !refreshing && (
          <View style={styles.listContainer}>
            <SkeletonOfferCard imageAspectRatio={16 / 9} style={styles.skeletonCard} />
            <SkeletonOfferCard imageAspectRatio={16 / 9} style={styles.skeletonCard} />
            <SkeletonOfferCard imageAspectRatio={16 / 9} style={styles.skeletonCard} />
          </View>
        )}

        {error && !isLoading && (
          <Card style={styles.errorCard}>
            <Icon name='alert-circle-outline' family='Ionicons' size={48} color={COLORS.danger} />
            <Text variant='title' size='md' weight='semibold' style={styles.errorTitle}>
              Failed to Load Favorites
            </Text>
            <Text variant='body' size='sm' style={styles.errorSubtext}>
              {error instanceof Error ? error.message : 'An error occurred'}
            </Text>
            <Button variant='primary' size='md' onPress={handleRetry}>
              Try Again
            </Button>
          </Card>
        )}

        {!isLoading && !error && !hasFavorites && (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[COLORS.brandSoftStart, COLORS.brandSoftEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconContainer}
            >
              <Icon name='heart-outline' family='Ionicons' size={64} color={COLORS.success} />
            </LinearGradient>

            <Text style={styles.emptyTitle}>No Favorites Yet</Text>

            <Text style={styles.emptyDescription}>
              Save your favorite offers to quickly access them later. Tap the heart icon on any
              offer to add it here.
            </Text>

            <Pressable style={styles.browseButton} onPress={handleBrowseOffers}>
              <Icon name='search-outline' family='Ionicons' size={20} color={COLORS.textInverse} />
              <Text style={styles.browseButtonText}>Browse Offers</Text>
            </Pressable>

            <View style={styles.tipCard}>
              <View style={styles.tipIconContainer}>
                <Icon name='bulb-outline' family='Ionicons' size={20} color={COLORS.warning} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginRight: 8,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
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
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.textInverse,
  },
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
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brand,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.brand,
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
    color: COLORS.textInverse,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 32,
    borderWidth: 1,
    borderColor: COLORS.surfaceAccent,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
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
    backgroundColor: COLORS.surfaceAccent,
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
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
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
  errorCard: {
    marginHorizontal: 16,
    marginTop: 32,
    padding: 24,
    alignItems: 'center',
    borderRadius: 16,
  },
  errorTitle: {
    marginTop: 12,
    color: COLORS.textPrimary,
  },
  errorSubtext: {
    marginTop: 8,
    marginBottom: 16,
    color: COLORS.textSecondary,
  },
});
