/**
 * Offer Card Component
 * Displays offer summary in a card format for lists and carousels
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Text, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { OfferListItem } from '../types/offer.types';
import type { MainStackNavigationProp } from '@/navigation/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.75; // 75% of screen width for carousel
const IMAGE_HEIGHT = 160;

interface OfferCardProps {
  offer: OfferListItem;
  variant?: 'carousel' | 'list';
  testID?: string;
}

export const OfferCard: React.FC<OfferCardProps> = ({
  offer,
  variant = 'carousel',
  testID
}) => {
  const theme = useTheme();
  const navigation = useNavigation<MainStackNavigationProp>();

  const handlePress = () => {
    navigation.navigate('OfferDetails', { offerId: offer._id });
  };

  const cardWidth = variant === 'carousel' ? CARD_WIDTH : undefined;

  // Calculate availability
  const availableQuantity =
    offer.totalQuantity - (offer.reservedQuantity || 0) - (offer.soldQuantity || 0);

  // Get first image or placeholder
  const imageUrl = offer.images?.[0];
  const hasImage = imageUrl && imageUrl.trim() !== '';

  // Format price
  const formatPrice = (price: number, currency: string = 'TND') => {
    return `${price.toFixed(2)} ${currency}`;
  };

  // Calculate discount badge text
  const discountText = offer.pricing?.discountPercentage
    ? `-${Math.round(offer.pricing.discountPercentage)}%`
    : null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${offer.title}, ${formatPrice(offer.pricing.discountedPrice)}`}
      accessibilityHint="Tap to view offer details"
    >
      <Card style={[styles.card, { width: cardWidth }]}>
        {/* Image Section */}
        <View style={styles.imageContainer}>
          {hasImage ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={`${offer.title} image`}
            />
          ) : (
            <View
              style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}
              accessibilityLabel="No image available"
            >
              <Text variant="headline" size="xl" style={{ opacity: 0.5 }}>
                🍽️
              </Text>
            </View>
          )}

          {/* Discount Badge */}
          {discountText && (
            <View
              style={[styles.discountBadge, { backgroundColor: theme.colors.error }]}
              accessibilityLabel={`${discountText} discount`}
            >
              <Text variant="label" size="sm" weight="bold" style={{ color: '#fff' }}>
                {discountText}
              </Text>
            </View>
          )}

          {/* Status Badge */}
          {offer.status === 'active' && availableQuantity > 0 && availableQuantity <= 5 && (
            <View
              style={[styles.statusBadge, { backgroundColor: theme.colors.warning }]}
              accessibilityLabel={`Only ${availableQuantity} left`}
            >
              <Text variant="label" size="xs" weight="bold" style={{ color: '#fff' }}>
                Only {availableQuantity} left!
              </Text>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          {/* Title */}
          <Text
            variant="body"
            size="md"
            weight="semibold"
            numberOfLines={2}
            style={styles.title}
          >
            {offer.title}
          </Text>

          {/* Establishment Name */}
          {offer.establishmentName && (
            <Text
              variant="body"
              size="sm"
              color="secondary"
              numberOfLines={1}
              style={styles.establishment}
            >
              📍 {offer.establishmentName}
            </Text>
          )}

          {/* Pricing */}
          <View style={styles.pricingRow}>
            <View style={styles.priceContainer}>
              <Text
                variant="headline"
                size="md"
                weight="bold"
                style={{ color: theme.colors.primary }}
              >
                {formatPrice(offer.pricing.discountedPrice, offer.pricing.currency)}
              </Text>
              {offer.pricing.originalPrice && offer.pricing.originalPrice > offer.pricing.discountedPrice && (
                <Text
                  variant="body"
                  size="sm"
                  color="secondary"
                  style={styles.originalPrice}
                >
                  {formatPrice(offer.pricing.originalPrice, offer.pricing.currency)}
                </Text>
              )}
            </View>

            {/* Availability */}
            {availableQuantity > 0 ? (
              <Text variant="label" size="xs" color="secondary">
                {availableQuantity} available
              </Text>
            ) : (
              <Text variant="label" size="xs" style={{ color: theme.colors.error }}>
                Sold out
              </Text>
            )}
          </View>

          {/* Type Badge */}
          {offer.type && (
            <View style={styles.typeBadgeContainer}>
              <View style={[styles.typeBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text
                  variant="label"
                  size="xs"
                  weight="medium"
                  style={{ color: theme.colors.onPrimaryContainer }}
                >
                  {offer.type.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    marginRight: 12,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  content: {
    padding: 12,
  },
  title: {
    marginBottom: 6,
  },
  establishment: {
    marginBottom: 8,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },
  typeBadgeContainer: {
    marginTop: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
