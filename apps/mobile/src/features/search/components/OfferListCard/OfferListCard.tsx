/**
 * OfferListCard Component
 *
 * Beautiful card for displaying offers in the list view.
 * Optimized for vertical scrolling with all the details visible.
 *
 * Design features:
 * - Large offer image with merchant logo overlay (bottom left)
 * - Merchant name below the image
 * - Pickup time range
 * - Distance badge
 * - Original price (crossed) + discounted price (bottom right)
 * - Rating (bottom left, under pickup time)
 */

import React from 'react';
import { View, StyleSheet, Pressable, Image, Dimensions } from 'react-native';

import { Text, Icon, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { ProximitySearchResult, NearbyOffer } from '@/features/offers/hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with 16px padding on sides and 16px gap
const IMAGE_HEIGHT = 130;

// ============================================================================
// Types
// ============================================================================

interface OfferListCardProps {
  offer: ProximitySearchResult<NearbyOffer>;
  onPress: () => void;
  style?: object;
}

// ============================================================================
// Component
// ============================================================================

const OfferListCardComponent: React.FC<OfferListCardProps> = ({ offer, onPress, style }) => {
  const theme = useTheme();
  const { item, distance } = offer;
  const offerImage = item.images?.[0];

  // Format pickup time - convert UTC to local timezone
  const pickupTime = item.availableUntil
    ? new Date(item.availableUntil).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : 'Today';

  const merchantLogoUrl = item.establishmentLogo ?? null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, style]}
      accessibilityRole='button'
      accessibilityLabel={`${item.title} from ${item.establishmentName}, ${distance.formatted} away`}
    >
      <Card
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.background,
            shadowColor: '#000',
          },
        ]}
      >
        {/* Image Section */}
        <View style={styles.imageSection}>
          {offerImage ? (
            <Image source={{ uri: offerImage }} style={styles.offerImage} resizeMode='cover' />
          ) : (
            <View
              style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              <Icon
                name='fast-food'
                family='Ionicons'
                size={36}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )}

          {/* Merchant Logo Overlay */}
          <View
            style={[styles.merchantLogoContainer, { backgroundColor: theme.colors.background }]}
          >
            {merchantLogoUrl ? (
              <Image
                source={{ uri: merchantLogoUrl }}
                style={styles.merchantLogo}
                resizeMode='cover'
              />
            ) : (
              <View
                style={[
                  styles.merchantLogoPlaceholder,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Text variant='label' size='sm' weight='bold' color='primary'>
                  {item.establishmentName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Discount Badge */}
          {item.pricing.discountPercentage > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: theme.colors.accent }]}>
              <Text
                variant='label'
                size='xs'
                weight='bold'
                style={{ color: theme.colors.onAccent }}
              >
                -{Math.round(item.pricing.discountPercentage)}%
              </Text>
            </View>
          )}

          {/* Distance Badge on Image */}
          <View style={[styles.distanceOnImage, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <Icon name='location-sharp' family='Ionicons' size={10} color='#fff' />
            <Text variant='label' size='xs' weight='semibold' style={styles.distanceOnImageText}>
              {distance.formatted}
            </Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.details}>
          {/* Merchant Name */}
          <Text variant='body' size='sm' weight='semibold' numberOfLines={1}>
            {item.establishmentName}
          </Text>

          {/* Offer Title */}
          <Text
            variant='body'
            size='xs'
            color='secondary'
            numberOfLines={1}
            style={styles.offerTitle}
          >
            {item.title}
          </Text>

          {/* Pickup Time Row */}
          <View style={styles.pickupRow}>
            <Icon name='time-outline' family='Ionicons' size={12} color={theme.colors.primary} />
            <Text
              variant='label'
              size='xs'
              color='primary'
              weight='medium'
              style={styles.pickupText}
            >
              {pickupTime}
            </Text>
          </View>

          {/* Bottom Row: Rating & Price */}
          <View style={styles.bottomRow}>
            {/* Rating */}
            <View style={styles.ratingContainer}>
              <Icon name='star' family='Ionicons' size={12} color='#FFB800' />
              <Text variant='label' size='xs' weight='semibold' style={styles.ratingText}>
                4.5
              </Text>
            </View>

            {/* Pricing */}
            <View style={styles.pricingContainer}>
              <Text variant='body' size='xs' color='secondary' style={styles.originalPrice}>
                {item.pricing.currency}
                {item.pricing.originalPrice.toFixed(0)}
              </Text>
              <Text variant='title' size='sm' weight='bold' color='success'>
                {item.pricing.currency}
                {item.pricing.discountedPrice.toFixed(0)}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

OfferListCardComponent.displayName = 'OfferListCard';

export const OfferListCard = React.memo(OfferListCardComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageSection: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  offerImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantLogoContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 8,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  merchantLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  merchantLogoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distanceOnImage: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distanceOnImageText: {
    color: '#fff',
    marginLeft: 3,
  },
  details: {
    padding: 10,
  },
  offerTitle: {
    marginTop: 2,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  pickupText: {
    marginLeft: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 3,
  },
  pricingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },
});

