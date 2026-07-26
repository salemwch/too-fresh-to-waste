/**
 * HomeOfferSection Component
 * Reusable section for displaying offers in horizontal carousel
 *
 * Responsibilities:
 * - Display section title with "See All" button
 * - Show loading state (skeleton cards)
 * - Show error state with retry button
 * - Show empty state with message
 * - Display offers in horizontal FlatList
 *
 * Best Practice: DRY Principle - Single reusable component replaces 4 duplicated sections
 * Eliminates 600+ lines of duplicated code
 */

import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, FlatList } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { FavoriteOfferCard } from '@/features/favorites';

import { HOME_UI_CONFIG } from '../constants/homeConstants';

import type { MascotVariant } from '@/design-system/components/organisms/OfferCard/OfferCard.types';
import type { OfferListItem } from '@/features/offers/types/offer.types';

// ============================================================================
// Types
// ============================================================================

interface HomeOfferSectionProps {
  /** Section title (e.g., "Urgent Deals ⚡") */
  title: string;
  /** Array of offers to display */
  offers: OfferListItem[] | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Callback to refetch data */
  onRefetch: () => void;
  /** Callback when offer card is pressed */
  onOfferPress: (offerId: string) => void;
  /** Callback when "See All" button is pressed */
  onSeeAllPress?: () => void;
  /** Message to show when no offers available */
  emptyMessage: string;
  /** Subtext to show below empty message */
  emptySubtext: string;
  /** Card variant for styling */
  variant?: 'featured' | 'default';
  /** Test ID prefix for testing */
  testIDPrefix: string;
  /** Bag mascot strip variant — passed through to each OfferCard in the section */
  mascotVariant?: MascotVariant;
  /** Translated copy for the mascot strip (caller provides via t()) */
  mascotCopy?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * HomeOfferSection Component
 *
 * Features:
 * - Reusable for all offer types (urgent, hottest, pickup today/tomorrow)
 * - Handles all states: loading, error, empty, data
 * - Horizontal scrolling with snap-to-interval
 * - Accessibility support
 * - Performance optimized with FlatList
 *
 * Performance:
 * - Memoized with React.memo
 * - FlatList with windowing
 * - Only re-renders when props change
 *
 * @example
 * ```typescript
 * <HomeOfferSection
 *   title="Urgent Deals ⚡"
 *   offers={urgentOffers}
 *   isLoading={isLoading.urgent}
 *   error={errors.urgent}
 *   onRefetch={refetch.urgent}
 *   onOfferPress={handleOfferPress}
 *   emptyMessage="No urgent deals right now"
 *   emptySubtext="Offers expiring within 1 hour will appear here"
 *   variant="featured"
 *   testIDPrefix="urgent"
 * />
 * ```
 */
const HomeOfferSectionComponent: React.FC<HomeOfferSectionProps> = ({
  title,
  offers,
  isLoading,
  error,
  onRefetch,
  onOfferPress,
  onSeeAllPress,
  emptyMessage,
  emptySubtext,
  variant = 'default',
  testIDPrefix,
  mascotVariant,
  mascotCopy,
}) => {
  const { t } = useTranslation();
  // ============================================================================
  // Memoized renderItem callbacks — stable references for FlatList
  // ============================================================================

  const renderSkeletonItem = useCallback(
    ({ index }: { item: number; index: number }) => (
      <SkeletonOfferCard
        imageAspectRatio={1.8}
        style={styles.offerCardItem}
        testID={`${testIDPrefix}-skeleton-${index}`}
      />
    ),
    [testIDPrefix],
  );

  const renderOfferItem = useCallback(
    ({ item }: { item: OfferListItem }) => (
      <FavoriteOfferCard
        offer={item}
        variant={variant}
        imageAspectRatio={1.8}
        onPress={offer => onOfferPress(offer.id)}
        testID={`${testIDPrefix}-offer-${item.id}`}
        style={styles.offerCardItem}
        {...(mascotVariant != null ? { mascotVariant } : {})}
        {...(mascotCopy != null ? { mascotCopy } : {})}
      />
    ),
    [variant, onOfferPress, testIDPrefix, mascotVariant, mascotCopy],
  );

  // ============================================================================
  // Render States
  // ============================================================================

  /**
   * Loading State - Show skeleton cards
   */
  if (isLoading) {
    return (
      <View style={styles.section}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text variant='title' size='lg' weight='semibold'>
            {title}
          </Text>
          {onSeeAllPress && (
            <Button
              variant='ghost'
              size='sm'
              onPress={onSeeAllPress}
              accessibilityLabel={t('home.a11ySeeAll', { section: title })}
              accessibilityHint={t('home.a11yOpenFullList')}
            >
              {t('common.seeAll')}
            </Button>
          )}
        </View>

        {/* Skeleton Loading State */}
        <FlatList
          data={Array.from({ length: HOME_UI_CONFIG.SKELETON_CARD_COUNT }, (_, i) => i)}
          renderItem={renderSkeletonItem}
          keyExtractor={item => `skeleton-${testIDPrefix}-${item}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          scrollEnabled={false}
          getItemLayout={(_data, index) => ({
            length: HOME_UI_CONFIG.CAROUSEL_CARD_WIDTH,
            offset: HOME_UI_CONFIG.CAROUSEL_CARD_WIDTH * index,
            index,
          })}
        />
      </View>
    );
  }

  /**
   * Error State - Show error message with retry button
   */
  if (error && offers === undefined) {
    return (
      <View style={styles.section}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text variant='title' size='lg' weight='semibold'>
            {title}
          </Text>
          {onSeeAllPress && (
            <Button
              variant='ghost'
              size='sm'
              onPress={onSeeAllPress}
              accessibilityLabel={t('home.a11ySeeAll', { section: title })}
              accessibilityHint={t('home.a11yOpenFullList')}
            >
              {t('common.seeAll')}
            </Button>
          )}
        </View>

        {/* Error State */}
        <Card style={styles.placeholderCard}>
          <Text variant='body' size='md' color='error' align='center'>
            {t('home.sectionLoadFailed')}
          </Text>
          <Button
            variant='outline'
            size='sm'
            onPress={onRefetch}
            style={styles.retryButton}
            accessibilityLabel={t('home.a11yRetrySection', { section: title })}
            accessibilityHint={t('home.a11yReloadData')}
            testID={`${testIDPrefix}-retry-button`}
          >
            {t('common.retry')}
          </Button>
        </Card>
      </View>
    );
  }

  /**
   * Empty State - Show empty message
   */
  if (!offers || offers.length === 0) {
    return (
      <View style={styles.section}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text variant='title' size='lg' weight='semibold'>
            {title}
          </Text>
          {onSeeAllPress && (
            <Button
              variant='ghost'
              size='sm'
              onPress={onSeeAllPress}
              accessibilityLabel={t('home.a11ySeeAll', { section: title })}
              accessibilityHint={t('home.a11yOpenFullList')}
            >
              {t('common.seeAll')}
            </Button>
          )}
        </View>

        {/* Empty State */}
        <Card style={styles.placeholderCard}>
          <Text variant='body' size='md' color='secondary' align='center'>
            {emptyMessage}
          </Text>
          <Text
            variant='body'
            size='sm'
            color='secondary'
            align='center'
            style={styles.placeholderSubtext}
          >
            {emptySubtext}
          </Text>
        </Card>
      </View>
    );
  }

  /**
   * Data State - Show offers carousel
   */
  return (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text variant='title' size='lg' weight='semibold'>
          {title}
        </Text>
        {onSeeAllPress && (
          <Button
            variant='ghost'
            size='sm'
            onPress={onSeeAllPress}
            accessibilityLabel={t('home.a11ySeeAll', { section: title })}
            accessibilityHint={t('home.a11yOpenFullList')}
            testID={`${testIDPrefix}-see-all-button`}
          >
            {t('common.seeAll')}
          </Button>
        )}
      </View>

      {/* Offers Carousel */}
      <FlatList
        data={offers}
        renderItem={renderOfferItem}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContainer}
        snapToInterval={HOME_UI_CONFIG.CAROUSEL_CARD_WIDTH}
        decelerationRate='fast'
        accessibilityLabel={`${title} carousel`}
        accessibilityHint={t('home.a11yBrowseOffers')}
        getItemLayout={(_data, index) => ({
          length: HOME_UI_CONFIG.CAROUSEL_CARD_WIDTH,
          offset: HOME_UI_CONFIG.CAROUSEL_CARD_WIDTH * index,
          index,
        })}
        // Performance optimizations
        windowSize={2}
        maxToRenderPerBatch={2}
        initialNumToRender={3}
        removeClippedSubviews
      />
    </View>
  );
};

HomeOfferSectionComponent.displayName = 'HomeOfferSection';

export const HomeOfferSection = memo(HomeOfferSectionComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 15,
  },
  carouselContainer: {
    paddingStart: 14,
    paddingEnd: 18,
    paddingVertical: 6,
  },
  offerCardItem: {
    marginEnd: 12,
    marginVertical: 3,
  },
  placeholderCard: {
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  placeholderSubtext: {
    marginTop: 8,
  },
  retryButton: {
    marginTop: 12,
  },
});
