/* eslint-disable react-native/no-unused-styles */
/**
 * OfferCard Organism
 * Production-ready reusable card for displaying food waste offers
 *
 * Features:
 * - Configurable variants (nearby, featured, surprise, default)
 * - Edge case handling (missing images, long text, zero stock)
 * - Full accessibility support
 * - Performance optimized with React.memo
 * - Type-safe with backend schema integration
 */

import React, { useMemo, useCallback, memo } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';

import { useTheme } from '../../../providers';
import { Badge } from '../../atoms/Badge';
import { Card } from '../../atoms/Card';
import { Text } from '../../atoms/Text';

import { formatPickupTime, formatDistance, offerTypeLabels } from './OfferCard.types';

import type { OfferCardProps } from './OfferCard.types';

/**
 * Placeholder image for missing offer images
 */
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300/E5E7EB/9CA3AF?text=No+Image';

/**
 * Color constants for OfferCard component
 * Extracted to comply with react-native/no-color-literals rule
 */
const COLORS = {
  HEART_DEFAULT: '#FF6B6B',
  HEART_UNFILLED: '#9CA3AF',
  ITEMS_LEFT_BG: '#fbf9be',
  ITEMS_LEFT_TEXT: '#005250',
  WHITE: '#FFFFFF',
  BLACK: '#000',
  SOLD_OUT_OVERLAY: 'rgba(0, 0, 0, 0.5)',
} as const;

/**
 * Heart icon component for favorite button
 */
const HeartIcon: React.FC<{ filled: boolean; size?: number; color?: string }> = ({
  filled,
  size = 20,
  color = COLORS.HEART_DEFAULT,
}) => {
  const heartStyles = StyleSheet.create({
    icon: {
      fontSize: size,
      color: filled ? color : COLORS.HEART_UNFILLED,
      lineHeight: size,
    },
  });

  return (
    <Text
      style={heartStyles.icon}
      accessibilityLabel={filled ? 'Remove from favorites' : 'Add to favorites'}
    >
      {filled ? '❤' : '♡'}
    </Text>
  );
};
/**
 * OfferCard Component
 */
export const OfferCard: React.FC<OfferCardProps> = memo(
  ({
    offer,
    layout = 'standard',
    orientation = 'vertical',
    showEstablishment = true,
    showPickupTime = true,
    showDistance = true,
    showItemsLeft = true,
    showFavorite = true,
    imageAspectRatio = 4 / 3,
    onPress,
    onFavorite,
    onEstablishmentPress,
    isFavorite = false,
    loading = false,
    disabled = false,
    style,
    imageStyle,
    contentStyle,
    testID = 'offer-card',
    accessibilityLabel,
    accessibilityHint,
  }) => {
    const theme = useTheme();
    const styles = createStyles(theme, orientation, layout, imageAspectRatio);

    // 🔍 DEBUG: Log offer data structure
    if (__DEV__) {
      console.log('========================================');
      console.log('🎴 OfferCard Data:', {
        offerId: offer.id,
        establishment: {
          name: offer.establishment?.name,
          profileImage: offer.establishment?.profileImage,
          hasProfileImage: !(offer.establishment?.profileImage == null),
        },
        pickupTimeSlots: offer.pickupTimeSlots,
        pickupTimeSlotsLength: offer.pickupTimeSlots?.length != null || 0,
      });
      console.log('========================================');
    }

    // ==================== Computed Values ====================
    // ✅ Backend provides availableQuantity (totalQuantity - sold - reserved)
    const itemsLeft = offer.availableQuantity;
    const pickupTime = useMemo(
      () => formatPickupTime(offer.pickupTimeSlots, offer.availableUntil),
      [offer.pickupTimeSlots, offer.availableUntil],
    );
    const distanceText = useMemo(() => formatDistance(offer.distance), [offer.distance]);
    const isOutOfStock = itemsLeft <= 0;

    // Image source with fallback
    const imageSource = useMemo(() => {
      const uri = offer.image ?? PLACEHOLDER_IMAGE;

      // Debug: Log image URL to help diagnose issues
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[OfferCard] Image URL:', {
          offerId: offer.id,
          imageUrl: uri,
          isPlaceholder: uri === PLACEHOLDER_IMAGE,
        });
      }

      return { uri };
    }, [offer.image, offer.id]);

    // Get establishment rating for display
    const hasRating = useMemo(
      () =>
        offer.establishment?.averageRating !== undefined && offer.establishment.averageRating > 0,
      [offer.establishment?.averageRating],
    );

    // ==================== Handlers ====================
    const handleCardPress = useCallback(() => {
      if (!disabled && !loading && onPress) {
        onPress(offer);
      }
    }, [disabled, loading, onPress, offer]);

    const handleFavoritePress = useCallback(
      (event: GestureResponderEvent) => {
        event.stopPropagation();
        if (!disabled && !loading && onFavorite) {
          onFavorite(offer);
        }
      },
      [disabled, loading, onFavorite, offer],
    );

    const handleEstablishmentPress = useCallback(
      (event: GestureResponderEvent) => {
        event.stopPropagation();
        if (!disabled && !loading && onEstablishmentPress) {
          // Note: OfferListItem doesn't expose establishmentId for security
          // Parent component should navigate using offer.id instead
          onEstablishmentPress(offer.id);
        }
      },
      [disabled, loading, onEstablishmentPress, offer.id],
    );

    // ==================== Accessibility ====================
    const accessibilityLabelText = useMemo(() => {
      if (accessibilityLabel !== undefined && accessibilityLabel.length > 0) {
        return accessibilityLabel;
      }
      let label = `${offer.title} from ${offer.establishment?.name ?? 'Unknown'}`;
      label += `, Price ${offer.pricing.discountedPrice} ${offer.pricing.currency}`;

      if (offer.pricing.discountPercentage > 0) {
        label += `, ${offer.pricing.discountPercentage}% off`;
      }
      if (distanceText !== null && distanceText.length > 0) {
        label += `, ${distanceText} away`;
      }
      if (itemsLeft > 0) {
        label += `, ${itemsLeft} items left`;
      } else {
        label += ', Sold out';
      }

      return label;
    }, [accessibilityLabel, offer, distanceText, itemsLeft]);

    // ==================== Render Functions ====================

    /**
     * Render image section with overlays
     */
    const renderImage = () => (
      <View style={[styles.imageContainer, imageStyle]}>
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode='cover'
          accessibilityIgnoresInvertColors
        />

        {/* Top left badge - items left only */}
        <View style={styles.topLeftBadges}>
          {showItemsLeft && itemsLeft > 0 && (
            <View style={styles.itemsLeftBadge}>
              <Text variant='label.small' style={styles.itemsLeftText}>
                {`${itemsLeft > 5 ? '5+' : itemsLeft} left`}
              </Text>
            </View>
          )}
        </View>

        {/* Top right badge - rating only */}
        {hasRating && (
          <View style={styles.ratingBadge}>
            <View style={styles.ratingBadgeContent}>
              <Text variant='label.small' style={styles.starIcon}>
                ★
              </Text>
              <Text variant='label.small' style={styles.ratingText}>
                {offer.establishment.averageRating!.toFixed(1)}
              </Text>
            </View>
          </View>
        )}

        {/* Bottom left establishment logo */}
        {showEstablishment && !!offer.establishment?.name && (
          <View style={styles.establishmentLogo}>
            {offer.establishment.profileImage !== null &&
            offer.establishment.profileImage !== undefined &&
            offer.establishment.profileImage.length > 0 ? (
              <Image
                source={{ uri: offer.establishment.profileImage }}
                style={styles.logoImage}
                resizeMode='cover'
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text variant='label.small' numberOfLines={1}>
                  {offer.establishment.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <View style={styles.soldOutOverlay}>
            <Badge variant='error' size='md' label='SOLD OUT' />
          </View>
        )}
      </View>
    );

    /**
     * Render establishment name with favorite button
     */
    const renderEstablishment = () => {
      if (!showEstablishment || !offer.establishment?.name) return null;

      return (
        <View style={styles.establishmentRow}>
          <TouchableOpacity
            onPress={handleEstablishmentPress}
            disabled={!onEstablishmentPress}
            accessibilityRole='button'
            accessibilityLabel={`View ${offer.establishment.name}`}
            style={styles.establishmentNameContainer}
          >
            <Text
              variant='body.medium'
              weight='semibold'
              numberOfLines={1}
              style={styles.establishmentName}
            >
              {offer.establishment.name}
            </Text>
          </TouchableOpacity>

          {/* Favorite button moved to content section */}
          {showFavorite && (
            <TouchableOpacity
              onPress={handleFavoritePress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole='button'
              accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              style={styles.favoriteButtonContent}
            >
              <HeartIcon filled={isFavorite} size={20} color={theme.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
      );
    };

    /**
     * Render offer title (item type)
     */
    const renderTitle = () => (
      <Text
        variant='body.small'
        color={theme.colors.onSurfaceVariant}
        numberOfLines={1}
        style={styles.title}
      >
        {offerTypeLabels[offer.type]}
      </Text>
    );

    /**
     * Render pickup time with distance
     */
    const renderPickupTime = () => {
      if (!showPickupTime) return null;

      const hasPickupTime =
        pickupTime !== null && pickupTime !== undefined && pickupTime.length > 0;
      const hasDistance =
        showDistance &&
        distanceText !== null &&
        distanceText !== undefined &&
        distanceText.length > 0;

      // Don't render if nothing to show
      if (!hasPickupTime && !hasDistance) return null;

      return (
        <View style={styles.pickupTimeRow}>
          {hasPickupTime && (
            <Text
              variant='body.small'
              color={theme.colors.onSurfaceVariant}
              numberOfLines={1}
              style={styles.pickupTime}
            >
              🕐 Pick up today : {pickupTime}
            </Text>
          )}
          {hasDistance && (
            <Text
              variant='body.small'
              color={theme.colors.onSurfaceVariant}
              style={styles.distanceText}
            >
              {hasPickupTime ? '• ' : ''}
              {distanceText}
            </Text>
          )}
        </View>
      );
    };

    /**
     * Render bottom row with price only
     */
    const renderBottomRow = () => {
      const hasDiscount = offer.pricing.originalPrice !== offer.pricing.discountedPrice;

      return (
        <View style={styles.bottomRow}>
          {/* Price */}
          <View style={styles.priceContainer}>
            {hasDiscount && (
              <Text
                variant='body.small'
                color={theme.colors.onSurfaceVariant}
                style={styles.originalPrice}
              >
                {offer.pricing.currency}
                {offer.pricing.originalPrice.toFixed(2)}
              </Text>
            )}
            <Text variant='body.medium' weight='bold' style={styles.currentPrice}>
              {offer.pricing.currency}
              {offer.pricing.discountedPrice.toFixed(2)}
            </Text>
          </View>
        </View>
      );
    };

    // ==================== Main Render ====================
    return (
      <Card
        variant='elevated'
        pressable={!!onPress && !disabled && !loading}
        onPress={handleCardPress}
        disabled={disabled || isOutOfStock}
        style={[styles.card, style]}
        testID={testID}
        accessibilityLabel={accessibilityLabelText}
        accessibilityHint={accessibilityHint ?? 'Double tap to view offer details'}
        accessibilityRole='button'
      >
        {renderImage()}

        <View style={[styles.content, contentStyle]}>
          {renderEstablishment()}
          {renderTitle()}
          {renderPickupTime()}
          {renderBottomRow()}
        </View>
      </Card>
    );
  },
);

OfferCard.displayName = 'OfferCard';

// ==================== Styles ====================
const createStyles = (
  theme: ReturnType<typeof useTheme>,
  orientation: 'vertical' | 'horizontal',
  _layout: 'compact' | 'standard' | 'detailed',
  imageAspectRatio: number,
) => {
  const isHorizontal = orientation === 'horizontal';

  return StyleSheet.create({
    card: {
      flexDirection: isHorizontal ? 'row' : 'column',
      minWidth: isHorizontal ? 300 : 280,
      maxWidth: isHorizontal ? 400 : 320,
      borderRadius: 20,
      overflow: 'hidden',
      padding: 5, // Override Card component's default padding: 16
      // Enhanced shadow for better card depth
      shadowColor: COLORS.BLACK,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
    imageContainer: {
      position: 'relative',
      width: isHorizontal ? 120 : '100%',
      aspectRatio: isHorizontal ? 1 : imageAspectRatio,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: 10,
    },
    topLeftBadges: {
      position: 'absolute',
      top: theme.spacing.base.sm,
      left: theme.spacing.base.sm,
      gap: theme.spacing.base.xs,
    },
    itemsLeftBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.ITEMS_LEFT_BG,
      paddingHorizontal: theme.spacing.base.xs,
      paddingVertical: 4,
      borderRadius: theme.spacing.radius.sm,
    },
    itemsLeftText: {
      color: COLORS.ITEMS_LEFT_TEXT,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 10,
    },
    ratingBadge: {
      position: 'absolute',
      top: theme.spacing.base.sm,
      right: theme.spacing.base.sm,
    },
    ratingBadgeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.base.xs,
      paddingVertical: 4,
      borderRadius: theme.spacing.radius.sm,
      gap: 2,
    },
    starIcon: {
      color: COLORS.WHITE,
      fontSize: 12,
      lineHeight: 10,
    },
    ratingText: {
      color: COLORS.WHITE,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 10,
    },
    establishmentLogo: {
      position: 'absolute',
      bottom: theme.spacing.base.sm,
      left: theme.spacing.base.sm,
    },
    logoImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.surface,
      shadowColor: COLORS.BLACK,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    logoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: COLORS.BLACK,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    soldOutOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: COLORS.SOLD_OUT_OVERLAY,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
      padding: 10,
    },
    establishmentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 2,
      gap: theme.spacing.base.xs,
    },
    establishmentNameContainer: {
      flex: 1,
    },
    establishmentName: {
      fontSize: 16,
      lineHeight: 20,
    },
    favoriteButtonContent: {
      padding: 4,
      marginTop: -4,
      marginRight: -4,
    },
    title: {
      marginBottom: 4,
    },
    pickupTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: 8,
    },
    pickupTime: {
      flexShrink: 1,
    },
    distanceText: {
      flexShrink: 0,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.base.xs,
    },
    originalPrice: {
      textDecorationLine: 'line-through',
    },
    currentPrice: {
      fontSize: 16,
    },
  });
};

export default OfferCard;
