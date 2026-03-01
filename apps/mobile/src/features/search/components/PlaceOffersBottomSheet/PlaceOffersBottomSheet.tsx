/**
 * PlaceOffersBottomSheet Component
 *
 * Slides up from the bottom when a place is selected from search.
 * Shows the place name/address header and a scrollable list of offers.
 *
 * Animation pattern reused from OfferMapCard (spring + timing parallel).
 *
 * @module PlaceOffersBottomSheet
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { FavoriteOfferCard } from '@/features/favorites';
import type { ProximitySearchResult, NearbyOffer } from '@/features/offers/hooks';
import { OfferType, CtaState, OfferStatus } from '@/features/offers/types/offer.types';
import type { OfferListItem } from '@/features/offers/types/offer.types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;

// ============================================================================
// Types
// ============================================================================

export interface PlaceOffersBottomSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Selected place name */
  placeName: string;
  /** Selected place address/subtext */
  placeAddress: string;
  /** Offers at the selected place */
  offers: ProximitySearchResult<NearbyOffer>[];
  /** Whether offers are loading */
  isLoading: boolean;
  /** Called when the sheet is dismissed */
  onClose: () => void;
  /** Called when an offer is tapped */
  onOfferPress: (offerId: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

const mapToOfferListItem = (result: ProximitySearchResult<NearbyOffer>): OfferListItem => {
  const { item, distance } = result;

  let distanceInMeters = distance.value;
  if (distance.unit === 'kilometers') {
    distanceInMeters = distance.value * 1000;
  } else if (distance.unit === 'miles') {
    distanceInMeters = distance.value * 1609.34;
  }

  return {
    id: item._id,
    title: item.title,
    type: OfferType.SURPRISE_BAG,
    image: item.images?.[0] ?? undefined,
    pricing: {
      originalPrice: item.pricing.originalPrice,
      discountedPrice: item.pricing.discountedPrice,
      discountPercentage: item.pricing.discountPercentage,
      currency: item.pricing.currency as 'TND',
    },
    availableQuantity: item.availableQuantity,
    availableUntil: item.availableUntil,
    establishment: {
      name: item.establishmentName,
    },
    distance: distanceInMeters,
    ctaState: item.availableQuantity > 0 ? CtaState.AVAILABLE : CtaState.SOLD_OUT,
    status: OfferStatus.ACTIVE,
  };
};

// ============================================================================
// Component
// ============================================================================

export const PlaceOffersBottomSheet: React.FC<PlaceOffersBottomSheetProps> = ({
  visible,
  placeName,
  placeAddress,
  offers,
  isLoading,
  onClose,
  onOfferPress,
}) => {
  const theme = useTheme();
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false);
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

  const renderItem = useCallback(
    ({ item }: { item: ProximitySearchResult<NearbyOffer> }) => {
      const offerData = mapToOfferListItem(item);
      return (
        <FavoriteOfferCard
          offer={offerData}
          variant='default'
          imageAspectRatio={1.4}
          onPress={() => onOfferPress(item.item._id)}
          testID={`place-offer-${item.item._id}`}
          style={styles.offerCard}
        />
      );
    },
    [onOfferPress],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size='large' color={theme.colors.primary} />
          <Text variant='body' size='sm' color='secondary' style={styles.loadingText}>
            Loading offers...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContent}>
        <Icon
          name='bag-outline'
          family='Ionicons'
          size={40}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant='body' size='md' color='secondary' style={styles.emptyText}>
          No offers available at this location
        </Text>
      </View>
    );
  }, [isLoading, theme.colors]);

  React.useEffect(() => { if (visible) setHasBeenVisible(true); }, [visible]);
  if (!visible && !hasBeenVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
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

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant='title' size='md' weight='bold' numberOfLines={1}>
              {placeName}
            </Text>
            <Text variant='body' size='sm' color='secondary' numberOfLines={1}>
              {placeAddress}
            </Text>
          </View>
          <Pressable
            style={[styles.closeButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name='close' family='Ionicons' size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {/* Offers count */}
        {!isLoading && offers.length > 0 && (
          <View style={styles.countRow}>
            <Text variant='label' size='sm' weight='semibold' color='primary'>
              {offers.length} {offers.length === 1 ? 'offer' : 'offers'} available
            </Text>
          </View>
        )}

        {/* Offers List */}
        <FlatList
          data={offers}
          keyExtractor={item => item.item._id}
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
    bottom: 0,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
  },
});

export default PlaceOffersBottomSheet;
