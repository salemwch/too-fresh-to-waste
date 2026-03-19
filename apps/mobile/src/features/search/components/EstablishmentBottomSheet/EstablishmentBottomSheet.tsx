/**
 * EstablishmentBottomSheet Component
 *
 * Slides up when a map marker is tapped.
 * Shows establishment header (image, name, rating) + scrollable offer list.
 * Empty state when no offers available.
 *
 * Animation pattern reused from PlaceOffersBottomSheet (spring + timing parallel).
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { FavoriteOfferCard } from '@/features/favorites';
import { OfferType, CtaState, OfferStatus } from '@/features/offers/types/offer.types';
import type { OfferListItem } from '@/features/offers/types/offer.types';

import type {
  ProximitySearchResult,
  MapEstablishment,
  MapOfferSummary,
} from '@/features/offers/hooks';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;

// ============================================================================
// Types
// ============================================================================

export interface EstablishmentBottomSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** The selected establishment (null when hidden) */
  establishment: ProximitySearchResult<MapEstablishment> | null;
  /** Called when the sheet is dismissed */
  onClose: () => void;
  /** Called when an offer is tapped */
  onOfferPress: (offerId: string) => void;
  /** Extra bottom inset to keep sheet above tab bar */
  bottomInset?: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map a MapOfferSummary (from the establishment's embedded offers)
 * into an OfferListItem for FavoriteOfferCard.
 *
 * @param establishmentProfileImage - The establishment's profile image URI.
 *   Passed explicitly because MapOfferSummary (a lightweight summary) does
 *   not carry it — only the parent MapEstablishment does.
 */
const mapOfferToListItem = (
  offer: MapOfferSummary,
  establishmentName: string,
  establishmentProfileImage: string | null | undefined,
  distanceMeters: number,
): OfferListItem => ({
  id: offer._id,
  title: offer.title,
  type: OfferType.SURPRISE_BAG,
  image: offer.images?.[0] ?? undefined,
  pricing: {
    originalPrice: offer.pricing.originalPrice,
    discountedPrice: offer.pricing.discountedPrice,
    discountPercentage: offer.pricing.discountPercentage,
    currency: offer.pricing.currency as 'TND',
  },
  availableQuantity: offer.availableQuantity,
  availableFrom: offer.availableFrom,
  availableUntil: offer.availableUntil,
  establishment: {
    name: establishmentName,
    // Only set when non-null so exactOptionalPropertyTypes is satisfied
    ...(establishmentProfileImage != null ? { profileImage: establishmentProfileImage } : {}),
  },
  distance: distanceMeters,
  ctaState: new Date() < new Date(offer.availableFrom)
    ? CtaState.NOT_STARTED
    : offer.availableQuantity > 0 ? CtaState.AVAILABLE : CtaState.SOLD_OUT,
  status: OfferStatus.ACTIVE,
});

/** Convert distance to meters regardless of unit */
const toMeters = (result: ProximitySearchResult<MapEstablishment>): number => {
  const { value, unit } = result.distance;
  if (unit === 'kilometers') return value * 1000;
  if (unit === 'miles') return value * 1609.34;
  return value;
};

// ============================================================================
// Component
// ============================================================================

export const EstablishmentBottomSheet: React.FC<EstablishmentBottomSheetProps> = ({
  visible,
  establishment,
  onClose,
  onOfferPress,
  bottomInset = 0,
}) => {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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
          toValue: SHEET_HEIGHT,
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
  }, [visible, slideAnim, opacityAnim]);

  const item = establishment?.item;
  const distanceMeters = establishment ? toMeters(establishment) : 0;

  const renderItem = useCallback(
    ({ item: offer }: { item: MapOfferSummary }) => {
      if (!item) return null;
      const offerData = mapOfferToListItem(offer, item.name, item.profileImage, distanceMeters);
      return (
        <FavoriteOfferCard
          offer={offerData}
          variant='default'
          imageAspectRatio={1.4}
          onPress={() => onOfferPress(offer._id)}
          testID={`est-offer-${offer._id}`}
          style={styles.offerCard}
        />
      );
    },
    [item, distanceMeters, onOfferPress],
  );

  const renderEmpty = useCallback(() => (
    <View style={styles.centerContent}>
      <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Icon
          name='bag-outline'
          family='Ionicons'
          size={56}
          color={theme.colors.onSurfaceVariant}
        />
      </View>
      <Text variant='body' size='md' weight='medium' align='center' style={styles.emptyTitle}>
        Nothing available right now.
      </Text>
      <Text variant='body' size='sm' color='secondary' align='center'>
        Check back later!
      </Text>
      <Pressable
        style={[styles.notifyButton, { borderColor: theme.colors.outline }]}
        disabled
      >
        <Text variant='label' size='sm' color='secondary'>
          Notify Me
        </Text>
      </Pressable>
    </View>
  ), [theme.colors]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!visible && (opacityAnim as any)._value === 0) return null;

  const initial = item?.name?.charAt(0).toUpperCase() ?? '?';
  const ratingDisplay = (item?.averageRating ?? 0).toFixed(1);
  const reviewCount = item?.totalReviews ?? 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomInset,
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
            <Image source={{ uri: item.profileImage }} style={styles.headerImage} />
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
              <Text variant='body' size='sm' weight='medium' style={styles.ratingValue}>
                {ratingDisplay}
              </Text>
              <Text variant='body' size='xs' color='secondary'>
                ({reviewCount})
              </Text>
              {item?.type ? (
                <View style={[styles.typeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text variant='label' size='xs' color='secondary'>
                    {item.type}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Close button */}
          <Pressable
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
            <Text variant='label' size='sm' weight='semibold' color='primary'>
              {item!.activeOfferCount}{' '}
              {item!.activeOfferCount === 1 ? 'offer' : 'offers'} available
            </Text>
          </View>
        )}

        {/* ── Offers list ────────────────────────────────────────── */}
        <FlatList
          data={item?.offers ?? []}
          keyExtractor={o => o._id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={4}
          windowSize={5}
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
    position: 'absolute',
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    zIndex: 200,
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
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
    paddingVertical: 12,
  },
  headerImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  headerInitialWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingValue: {
    marginLeft: 3,
    marginRight: 2,
  },
  typeBadge: {
    marginLeft: 8,
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
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  offerCard: {
    marginVertical: 6,
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
    marginBottom: 12,
  },
  emptyTitle: {
    marginBottom: 4,
  },
  notifyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    opacity: 0.5,
  },
});

export default EstablishmentBottomSheet;
