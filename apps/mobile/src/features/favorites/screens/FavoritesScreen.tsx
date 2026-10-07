/**
 * Favorites Screen
 * Display user's saved offers with category filtering
 */

import { useFocusEffect } from '@react-navigation/native';
import { readingGradient } from '@/utils/rtl';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrefetchOffer } from '@/features/offers/hooks/useOffers';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
  Image,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Button, Card, Icon } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';
import { ESTABLISHMENT_CATEGORIES } from '@/features/offers/constants/establishmentCategories';
import { CtaState, OfferStatus } from '@/features/offers/types';
import { Logger } from '@/utils/logger';

import type {
  CategoryArtwork,
  EstablishmentCategoryId,
} from '@/features/offers/constants/establishmentCategories';

import { FavoriteEstablishmentRow } from '../components';
import { useFavoritesInfinite } from '../hooks';
import { favoritesService } from '../services';
import { FavoriteType } from '../types';

import type { FavoriteEstablishmentGroupData, FavoriteGroupItem } from '../components';
import type { Offer, OfferListItem } from '@/features/offers/types';
import type { FavoritesScreenNavigationProp } from '@/navigation/types';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { useFloatingTabBarContentInset } from '@/navigation/hooks/useFloatingTabBarInset';

const { base: sp } = spacingTokens;

interface FavoritesScreenProps {
  navigation: FavoritesScreenNavigationProp;
}

// ============================================================================
// Filter chip data — built once at module level, no per-render allocation
// ============================================================================

const CHIP_ART_SIZE = 22;

type FavoriteFilterId = 'all' | EstablishmentCategoryId;

interface FavoriteFilterDef {
  readonly id: FavoriteFilterId;
  readonly labelKey: string;
  readonly artwork: CategoryArtwork | null;
  /** The primary EstablishmentType sent to the backend. `undefined` = no filter. */
  readonly primaryType: string | undefined;
}

const FAVORITE_FILTERS: readonly FavoriteFilterDef[] = Object.freeze([
  { id: 'all', labelKey: 'favorites.all', artwork: null, primaryType: undefined },
  ...ESTABLISHMENT_CATEGORIES.map(c => ({
    id: c.id as FavoriteFilterId,
    labelKey: c.labelKey,
    artwork: c.artwork,
    primaryType: c.types[0] as string | undefined,
  })),
]);

/** O(1) lookup by id, so handleFilterChange never scans the array. */
const FILTER_BY_ID = new Map<FavoriteFilterId, FavoriteFilterDef>(
  FAVORITE_FILTERS.map(f => [f.id, f]),
);

// ============================================================================
// FilterChip — extracted and memoized (same pattern as HomeCategoryRail/CategoryTile)
// ============================================================================

interface FilterChipProps {
  filter: FavoriteFilterDef;
  isSelected: boolean;
  onPress: (id: FavoriteFilterId) => void;
}

const FilterChipComponent: React.FC<FilterChipProps> = ({ filter, isSelected, onPress }) => {
  const { t } = useTranslation();

  const handlePress = useCallback(() => {
    onPress(filter.id);
  }, [onPress, filter.id]);

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={t(filter.labelKey)}
      accessibilityHint={t('favorites.filterHint')}
      style={[styles.filterChip, isSelected && styles.filterChipActive]}
      onPress={handlePress}
    >
      {filter.artwork == null ? (
        <Icon
          name='apps-outline'
          family='Ionicons'
          size={18}
          color={isSelected ? COLORS.textInverse : COLORS.textSecondary}
        />
      ) : filter.artwork.kind === 'vector' ? (
        <filter.artwork.Icon width={CHIP_ART_SIZE} height={CHIP_ART_SIZE} />
      ) : (
        <Image
          source={filter.artwork.source}
          style={styles.chipArtwork}
          resizeMode='contain'
          accessibilityIgnoresInvertColors
        />
      )}
      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
        {t(filter.labelKey)}
      </Text>
    </Pressable>
  );
};

FilterChipComponent.displayName = 'FavoriteFilterChip';
const FilterChip = memo(FilterChipComponent);

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandSoftStart: '#F0FDF4',
  brandSoftEnd: '#DCFCE7',
  success: colorTokens.base.success[500],
  warning: colorTokens.base.warning[500],
  danger: colorTokens.base.error[500],
  surface: '#FFFFFF',
  surfaceAccent: '#FEF3C7',
  border: colorTokens.base.neutral[200],
  textPrimary: colorTokens.base.neutral[900],
  textSecondary: colorTokens.base.neutral[700],
  textInverse: '#FFFFFF',
  shadow: '#000',
} as const;

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
  // Content runs under the absolutely-positioned tab bar, so the list has to
  // pad itself or its last row can never be scrolled clear of the shape.
  const tabBarInset = useFloatingTabBarContentInset(styles.scrollContent);
  const theme = useTheme();
  const { t } = useTranslation();
  const prefetchOffer = usePrefetchOffer();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [establishmentType, setEstablishmentType] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useFavoritesInfinite({
      isActive: true,
      ...(establishmentType !== undefined && { establishmentType }),
    });

  const favorites = useMemo(() => data?.pages.flatMap(page => page.favorites) ?? [], [data]);

  const groupedFavorites = useMemo((): FavoriteEstablishmentGroupData[] => {
    const map = new Map<string, FavoriteEstablishmentGroupData>();

    for (const fav of favorites) {
      if (fav.type !== FavoriteType.OFFER) continue;

      let establishmentName = 'Unknown';
      let offer: OfferListItem | null = null;
      let isDeleted = false;

      if (isOfferListItem(fav.itemId) || isOfferDocument(fav.itemId)) {
        offer = toOfferListItem(fav.itemId);
        establishmentName = offer.establishment.name;
      } else {
        isDeleted = true;
      }

      const item: FavoriteGroupItem = {
        favoriteId: fav._id,
        offer,
        isDeleted,
      };

      const existing = map.get(establishmentName);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(establishmentName, { establishmentName, items: [item] });
      }
    }

    return Array.from(map.values());
  }, [favorites]);

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

  const handleFilterChange = useCallback((filterId: FavoriteFilterId) => {
    setSelectedFilter(filterId);
    setEstablishmentType(FILTER_BY_ID.get(filterId)?.primaryType);
  }, []);

  const renderEstablishmentGroup = useCallback(
    ({ item }: { item: FavoriteEstablishmentGroupData }) => (
      <FavoriteEstablishmentRow
        group={item}
        onOfferPress={handleOfferPress}
        onRemoveDeleted={handleRemoveDeletedFavorite}
      />
    ),
    [handleOfferPress, handleRemoveDeletedFavorite],
  );

  const renderListFooter = useCallback(
    () =>
      isFetchingNextPage ? (
        <View style={styles.loadingMore}>
          <SkeletonOfferCard imageAspectRatio={1.8} style={styles.skeletonCard} />
        </View>
      ) : null,
    [isFetchingNextPage],
  );

  const hasFavorites = groupedFavorites.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={tabBarInset}
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
            {FAVORITE_FILTERS.map(filter => (
              <FilterChip
                key={filter.id}
                filter={filter}
                isSelected={selectedFilter === filter.id}
                onPress={handleFilterChange}
              />
            ))}
          </ScrollView>
        </View>

        {isLoading && !refreshing && (
          <View style={styles.loadingContainer}>
            <SkeletonOfferCard imageAspectRatio={1.8} style={styles.skeletonCard} />
            <SkeletonOfferCard imageAspectRatio={1.8} style={styles.skeletonCard} />
          </View>
        )}

        {error && !isLoading && (
          <Card style={styles.errorCard}>
            <Icon name='alert-circle-outline' family='Ionicons' size={48} color={COLORS.danger} />
            <Text variant='title' size='md' weight='semibold' style={styles.errorTitle}>
              {t('favorites.failedToLoad')}
            </Text>
            <Text variant='body' size='sm' style={styles.errorSubtext}>
              {t('favorites.failedMessage')}
            </Text>
            <Button variant='primary' size='md' onPress={handleRetry}>
              {t('common.tryAgain')}
            </Button>
          </Card>
        )}

        {!isLoading && !error && !hasFavorites && (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[COLORS.brandSoftStart, COLORS.brandSoftEnd]}
              start={readingGradient(0, 1).start}
              end={readingGradient(0, 1).end}
              style={styles.emptyIconContainer}
            >
              <Icon name='heart-outline' family='Ionicons' size={64} color={COLORS.success} />
            </LinearGradient>

            <Text style={styles.emptyTitle}>{t('favorites.noFavorites')}</Text>

            <Text style={styles.emptyDescription}>{t('favorites.noFavoritesDescription')}</Text>

            <Pressable
              style={styles.browseButton}
              onPress={handleBrowseOffers}
              accessibilityRole='button'
            >
              <Icon name='search-outline' family='Ionicons' size={20} color={COLORS.textInverse} />
              <Text style={styles.browseButtonText}>{t('favorites.browseOffers')}</Text>
            </Pressable>

            <View style={styles.tipCard}>
              <View style={styles.tipIconContainer}>
                <Icon name='bulb-outline' family='Ionicons' size={20} color={COLORS.warning} />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{t('favorites.proTip')}</Text>
                <Text style={styles.tipText}>{t('favorites.proTipText')}</Text>
              </View>
            </View>
          </View>
        )}

        {!isLoading && !error && hasFavorites && (
          <View style={styles.favoritesSection}>
            <FlashList
              data={groupedFavorites}
              renderItem={renderEstablishmentGroup}
              keyExtractor={item => item.establishmentName}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              estimatedItemSize={240}
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
    marginTop: sp[5],
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
    marginEnd: 8,
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
  chipArtwork: {
    width: CHIP_ART_SIZE,
    height: CHIP_ART_SIZE,
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
    marginBottom: sp[3],
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
    marginEnd: sp[3],
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
    paddingTop: 4,
  },
  loadingContainer: {
    paddingHorizontal: 16,
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
    marginTop: sp[3],
    color: COLORS.textPrimary,
  },
  errorSubtext: {
    marginTop: 8,
    marginBottom: 16,
    color: COLORS.textSecondary,
  },
});
