/**
 * EstablishmentBottomSheet Component
 *
 * Slides up when a map marker is tapped.
 * Shows establishment header (image, name, rating) + scrollable offer list.
 * Empty state when no offers available.
 *
 * Animation pattern reused from PlaceOffersBottomSheet (spring + timing parallel).
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Animated, Pressable, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from 'react-native-fast-image';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { FavoriteOfferCard } from '@/features/favorites';
import { useFloatingTabBarInset } from '@/navigation/hooks/useFloatingTabBarInset';

import { distanceToMeters, mapOfferSummaryToListItem } from '../../utils/offerMappers';
import { getMapSheetGeometry } from '../../utils/mapSheetGeometry';

import type {
  ProximitySearchResult,
  MapEstablishment,
  MapOfferSummary,
} from '@/features/offers/hooks';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

const SHEET_SHADOW = '#000';

// ============================================================================
// Types
// ============================================================================

interface EstablishmentBottomSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** The selected establishment (null when hidden) */
  establishment: ProximitySearchResult<MapEstablishment> | null;
  /** Called when the sheet is dismissed */
  onClose: () => void;
  /** Called when an offer is tapped */
  onOfferPress: (offerId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const EstablishmentBottomSheet: React.FC<EstablishmentBottomSheetProps> = ({
  visible,
  establishment,
  onClose,
  onOfferPress,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  /*
   * The sheet is sized around the floating tab bar rather than ignoring it -
   * see `utils/mapSheetGeometry.ts` for why it grows instead of lifting.
   */
  const { height: screenHeight } = useWindowDimensions();
  const tabBarInset = useFloatingTabBarInset();
  const { sheetHeight, listPaddingBottom } = useMemo(
    () => getMapSheetGeometry({ screenHeight, tabBarInset }),
    [screenHeight, tabBarInset],
  );

  // Initialised from the first computed height; the effect below keeps the
  // hidden position in step if the height changes (rotation, inset arriving
  // late), or the sheet would rest part-way off screen.
  const [slideAnim] = useState(() => new Animated.Value(sheetHeight));
  const [opacityAnim] = useState(() => new Animated.Value(0));

  const sheetStyle = useMemo(() => ({ height: sheetHeight }), [sheetHeight]);
  // FlashList compares contentContainerStyle by identity, so this has to be
  // memoised - see `.claude/rules/performance.md`.
  const listContentStyle = useMemo(
    () => ({ paddingHorizontal: 16, paddingBottom: 16 + listPaddingBottom }),
    [listPaddingBottom],
  );

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: sheetHeight,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim, sheetHeight]);

  const item = establishment?.item;
  const distanceMeters = establishment ? distanceToMeters(establishment.distance) : 0;

  const renderItem = useCallback(
    ({ item: offer }: { item: MapOfferSummary }) => {
      if (!item) return null;
      const offerData = mapOfferSummaryToListItem(
        offer,
        item.name,
        item.profileImage,
        distanceMeters,
      );
      return (
        <FavoriteOfferCard
          offer={offerData}
          variant='default'
          layout='compact'
          imageAspectRatio={2.2}
          onPress={() => onOfferPress(offer._id)}
          testID={`est-offer-${offer._id}`}
          style={styles.offerCard}
        />
      );
    },
    [item, distanceMeters, onOfferPress],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.centerContent}>
        <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon
            name='bag-outline'
            family='Ionicons'
            size={56}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
        <Text
          variant='body'
          size='md'
          weight='medium'
          align='center'
          lineHeight={24}
          style={styles.emptyTitle}
        >
          {t('search.sheetEmptyTitle')}
        </Text>
        <Text variant='body' size='sm' color='secondary' align='center' lineHeight={20}>
          {t('search.sheetEmptySubtitle')}
        </Text>
        {/*
          A "Notify Me" button used to sit here. It was hardcoded `disabled`
          with `opacity: 0.5` and had no `onPress` at all, and nothing behind it
          existed either: no subscribe endpoint, and `notifyEstablishmentFollowers`
          in `websocket/gateways/offer.gateway.ts` is defined but never called by
          anything. So it was a control that could never be pressed and would
          have done nothing if it could. Removed rather than left as a promise
          the app cannot keep - DESIGN.md's empty state needs icon + heading +
          subtext, and the CTA is optional.
        */}
      </View>
    ),
    [theme.colors, t],
  );

  const initial = item?.name?.charAt(0).toUpperCase() ?? '?';
  const ratingDisplay = (item?.averageRating ?? 0).toFixed(1);
  const reviewCount = item?.totalReviews ?? 0;

  return (
    <Animated.View
      style={[
        styles.container,
        sheetStyle,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
        {/* Drag Handle */}
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
        </View>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Profile image or initial */}
          {item?.profileImage ? (
            <FastImage
              source={{
                uri: item.profileImage,
                priority: FastImage.priority.normal,
                cache: FastImage.cacheControl.immutable,
              }}
              style={styles.headerImage}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.headerImage,
                styles.headerInitialWrap,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text
                variant='title'
                size='lg'
                weight='bold'
                style={{ color: theme.colors.onPrimaryContainer }}
              >
                {initial}
              </Text>
            </View>
          )}

          {/* Name + rating + type */}
          <View style={styles.headerText}>
            <Text variant='title' size='md' weight='bold' numberOfLines={1}>
              {item?.name ?? ''}
            </Text>
            <View style={styles.ratingRow}>
              <Icon name='star' family='Ionicons' size={14} color='#F9A825' />
              <Text
                variant='body'
                size='sm'
                weight='medium'
                lineHeight={20}
                style={styles.ratingValue}
              >
                {ratingDisplay}
              </Text>
              <Text variant='body' size='xs' color='secondary' lineHeight={20}>
                ({reviewCount})
              </Text>
              {item?.type ? (
                <View style={[styles.typeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text variant='label' size='xs' color='secondary' lineHeight={18}>
                    {item.type}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Close button */}
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={t('common.close')}
            accessibilityHint={t('search.a11yClosePanel')}
            style={[styles.closeButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name='close' family='Ionicons' size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {/* ── Offer count ────────────────────────────────────────── */}
        {(item?.activeOfferCount ?? 0) > 0 && (
          <View style={styles.countRow}>
            <Text variant='label' size='sm' weight='semibold' color='primary' lineHeight={20}>
              {t('search.offersAvailable', { count: item!.activeOfferCount })}
            </Text>
          </View>
        )}

        {/* ── Offers list ────────────────────────────────────────── */}
        <FlashList
          data={item?.offers ?? []}
          keyExtractor={o => o._id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={listContentStyle}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={120}
        />
      </View>
    </Animated.View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    // Anchored at 0 and given its height inline: the height depends on the
    // safe-area inset, which is not known at module scope.
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: SHEET_SHADOW,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  /* ── Header ────────────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: sp[3],
  },
  headerImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginEnd: sp[3],
  },
  headerInitialWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginEnd: sp[3],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingValue: {
    marginStart: 3,
    marginEnd: 2,
  },
  typeBadge: {
    marginStart: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* ── Content ───────────────────────────────────────────────── */
  countRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  offerCard: {
    marginVertical: 4,
  },
  /* ── Empty state ───────────────────────────────────────────── */
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sp[3],
  },
  emptyTitle: {
    marginBottom: 4,
  },
});
