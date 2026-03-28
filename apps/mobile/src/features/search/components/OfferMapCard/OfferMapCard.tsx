/**
 * OfferMapCard Component
 *
 * Beautiful mini card that slides up from the bottom when a marker is tapped.
 * Shows offer details with merchant logo, image, pricing, and pickup time.
 *
 * Design features:
 * - Offer image with merchant logo overlay
 * - Pickup time range
 * - Distance badge
 * - Original price (crossed) + discounted price
 * - Rating with star icon
 * - Smooth slide-up animation
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated, Image } from 'react-native';

import { Text, Icon, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { ProximitySearchResult, NearbyOffer } from '@/features/offers/hooks';

const CARD_HEIGHT = 140;
const IMAGE_WIDTH = 120;

// ============================================================================
// Types
// ============================================================================

interface OfferMapCardProps {
  offer: ProximitySearchResult<NearbyOffer> | null;
  visible: boolean;
  onPress: () => void;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const OfferMapCard: React.FC<OfferMapCardProps> = ({ offer, visible, onPress, onClose }) => {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(CARD_HEIGHT + 50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate card in/out
  useEffect(() => {
    if (visible && offer) {
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
          toValue: CARD_HEIGHT + 50,
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
  }, [visible, offer, slideAnim, opacityAnim]);

  if (!offer) return null;

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

  // Mock merchant logo - in real app, this would come from the offer data
  const merchantLogoUrl = null; // Replace with actual merchant logo URL

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
      <Pressable
        onPress={onPress}
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
          {/* Close Button */}
          <Pressable
            style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name='close' family='Ionicons' size={16} color={theme.colors.onSurfaceVariant} />
          </Pressable>

          <View style={styles.content}>
            {/* Offer Image with Merchant Logo */}
            <View style={styles.imageContainer}>
              {offerImage ? (
                <Image source={{ uri: offerImage }} style={styles.offerImage} resizeMode='cover' />
              ) : (
                <View
                  style={[
                    styles.imagePlaceholder,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Icon
                    name='fast-food'
                    family='Ionicons'
                    size={32}
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
            </View>

            {/* Offer Details */}
            <View style={styles.details}>
              {/* Title */}
              <Text variant='title' size='sm' weight='bold' numberOfLines={1}>
                {item.title}
              </Text>

              {/* Merchant Name */}
              <Text
                variant='body'
                size='sm'
                color='secondary'
                numberOfLines={1}
                style={styles.merchantName}
              >
                {item.establishmentName}
              </Text>

              {/* Pickup Time */}
              <View style={styles.pickupRow}>
                <Icon
                  name='time-outline'
                  family='Ionicons'
                  size={14}
                  color={theme.colors.primary}
                />
                <Text
                  variant='label'
                  size='sm'
                  color='primary'
                  weight='medium'
                  style={styles.pickupText}
                >
                  Pickup: {pickupTime}
                </Text>
              </View>

              {/* Bottom Row: Distance, Rating, Price */}
              <View style={styles.bottomRow}>
                {/* Distance */}
                <View
                  style={[styles.distanceBadge, { backgroundColor: theme.colors.surfaceVariant }]}
                >
                  <Icon
                    name='location-sharp'
                    family='Ionicons'
                    size={12}
                    color={theme.colors.primary}
                  />
                  <Text variant='label' size='xs' weight='semibold' style={styles.distanceText}>
                    {distance.formatted}
                  </Text>
                </View>

                {/* Rating */}
                <View style={styles.ratingContainer}>
                  <Icon name='star' family='Ionicons' size={14} color='#FFB800' />
                  <Text variant='label' size='sm' weight='semibold' style={styles.ratingText}>
                    4.5
                  </Text>
                </View>

                {/* Spacer */}
                <View style={styles.spacer} />

                {/* Pricing */}
                <View style={styles.pricingContainer}>
                  <Text variant='body' size='xs' color='secondary' style={styles.originalPrice}>
                    {item.pricing.currency}
                    {item.pricing.originalPrice.toFixed(2)}
                  </Text>
                  <Text variant='title' size='md' weight='bold' color='success'>
                    {item.pricing.currency}
                    {item.pricing.discountedPrice.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Arrow indicator */}
          <View style={styles.arrowContainer}>
            <Icon
              name='chevron-forward'
              family='Ionicons'
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </Card>
      </Pressable>
    </Animated.View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  card: {
    borderRadius: 16,
    padding: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
  },
  imageContainer: {
    width: IMAGE_WIDTH,
    height: IMAGE_WIDTH - 20,
    borderRadius: 12,
    overflow: 'hidden',
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
    bottom: 6,
    left: 6,
    width: 32,
    height: 32,
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
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  details: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  merchantName: {
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
    marginTop: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceText: {
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  ratingText: {
    marginLeft: 3,
  },
  spacer: {
    flex: 1,
  },
  pricingContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    marginBottom: -2,
  },
  arrowContainer: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -10,
  },
});

