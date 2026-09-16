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

import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, FlatList, useWindowDimensions } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { SkeletonOfferCard } from '@/design-system/components/molecules';
import { FavoriteOfferCard } from '@/features/favorites';

import { HOME_UI_CONFIG } from '../constants/homeConstants';

import type { MascotVariant } from '@/design-system/components/organisms/OfferCard/OfferCard.types';
import type { OfferListItem } from '@/features/offers/types/offer.types';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { DEAL_CARD_RATIO, getCarouselWidth } from '../utils/carouselWidth';

const { base: sp } = spacingTokens;

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
 * Module scope, not an inline arrow: `keyExtractor` is a prop, so a fresh
 * identity each render makes FlatList treat its configuration as changed. It
 * closes over nothing, so there is no reason for it to live in the component.
 */
const offerKeyExtractor = (item: OfferListItem): string => item.id;

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
  /*
   * Derived from the live screen width, not a constant. A hardcoded 320px was
   * 82% of the 390dp phone it was tuned on, 89% of a 360dp one (the common
   * Android case here, where the peek all but vanished) and WIDER than a 320dp
   * screen. See utils/carouselWidth.ts.
   */
  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth, snapInterval } = getCarouselWidth({
    screenWidth,
    ratio: DEAL_CARD_RATIO,
    gap: sp[3],
  });

  /*
   * Memoised: contentContainerStyle and item styles are compared by identity,
   * so a fresh object each render re-lays-out every card in the row.
   */
  const cardStyle = useMemo(
    // One merged object, not an array: OfferCard types `style` as a plain
    // ViewStyle rather than StyleProp<ViewStyle>, so an array is not assignable.
    () => ({ width: cardWidth, maxWidth: cardWidth, marginEnd: sp[3], marginVertical: 3 }),
    [cardWidth],
  );
  const { t } = useTranslation();
  // ============================================================================
  // Memoized renderItem callbacks — stable references for FlatList
  // ============================================================================

  const renderSkeletonItem = useCallback(
    ({ index }: { item: number; index: number }) => (
      <SkeletonOfferCard
        imageAspectRatio={1.8}
        style={cardStyle}
        testID={`${testIDPrefix}-skeleton-${index}`}
      />
    ),
    // cardStyle: the card width follows the screen, so a rotation has to
    // re-render these or the row keeps the old width until something else
    // happens to invalidate it.
    [testIDPrefix, cardStyle],
  );

  // Hoisted out of renderOfferItem: an inline `offer => onOfferPress(offer.id)`
  // is a new function identity on every item render, which is exactly the prop
  // change that makes FavoriteOfferCard's memo bail out. One stable handler for
  // the whole list instead.
  const handleOfferPress = useCallback(
    (offer: OfferListItem) => onOfferPress(offer.id),
    [onOfferPress],
  );

  const renderOfferItem = useCallback(
    ({ item }: { item: OfferListItem }) => (
      <FavoriteOfferCard
        offer={item}
        variant={variant}
        imageAspectRatio={1.8}
        onPress={handleOfferPress}
        testID={`${testIDPrefix}-offer-${item.id}`}
        style={cardStyle}
        {...(mascotVariant != null ? { mascotVariant } : {})}
        {...(mascotCopy != null ? { mascotCopy } : {})}
      />
    ),
    [variant, handleOfferPress, testIDPrefix, mascotVariant, mascotCopy, cardStyle],
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
            length: snapInterval,
            offset: snapInterval * index,
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
        keyExtractor={offerKeyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContainer}
        snapToInterval={snapInterval}
        decelerationRate='fast'
        accessibilityLabel={`${title} carousel`}
        accessibilityHint={t('home.a11yBrowseOffers')}
        getItemLayout={(_data, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
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
    marginEnd: sp[3],
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
    marginTop: sp[3],
  },
});
