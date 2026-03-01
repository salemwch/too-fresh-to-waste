/**
 * FoodCard Organism
 * Production-ready food offer card with comprehensive functionality
 */

import React, { useCallback, useMemo } from 'react';
import { View, Image, Pressable } from 'react-native';

import { useTheme } from '../../../providers';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { Text } from '../../atoms/Text';
import { FoodTag } from '../../molecules/FoodTag';
import { PriceDisplay } from '../../molecules/PriceDisplay';

import type { FoodCardProps } from './FoodCard.types';

// Placeholder icons
const FavoriteIcon = ({ filled }: { filled: boolean }) => (
  <View
    style={{
      width: 20,
      height: 20,
      backgroundColor: filled ? '#F44336' : 'transparent',
      borderWidth: filled ? 0 : 2,
      borderColor: '#F44336',
      borderRadius: 10,
    }}
  />
);

const ShareIcon = () => (
  <View style={{ width: 20, height: 20, backgroundColor: '#666', borderRadius: 4 }} />
);

const ClockIcon = () => (
  <View style={{ width: 16, height: 16, backgroundColor: '#666', borderRadius: 2 }} />
);

const LocationIcon = () => (
  <View style={{ width: 16, height: 16, backgroundColor: '#666', borderRadius: 2 }} />
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <View
    style={{
      width: 14,
      height: 14,
      backgroundColor: filled ? '#FFD700' : '#E0E0E0',
      borderRadius: 2,
    }}
  />
);

export const FoodCard: React.FC<FoodCardProps> = ({
  offer,
  layout = 'standard',
  orientation = 'vertical',
  showDetails = true,
  showActions = true,
  showFavorite = true,
  showShare = true,
  showEstablishment = true,
  showPickupTime = true,
  showDistance = true,
  showRating = true,
  loading = false,
  disabled = false,
  imageAspectRatio = 16 / 9,
  titleLines = 2,
  descriptionLines = 2,
  style,
  imageStyle,
  contentStyle,
  actionStyle,
  reserveButtonText = 'Reserve',
  onPress,
  onReserve,
  onFavorite,
  onShare,
  onViewEstablishment,
  testID = 'food-card',
  accessibilityLabel,
  ...rest
}) => {
  const theme = useTheme();

  // Handle main card press
  const handleCardPress = useCallback(() => {
    if (!disabled && !loading && onPress) {
      onPress(offer);
    }
  }, [disabled, loading, onPress, offer]);

  // Handle reserve action
  const handleReserve = useCallback(
    (event: any) => {
      event.stopPropagation();
      if (!disabled && !loading && onReserve) {
        onReserve(offer);
      }
    },
    [disabled, loading, onReserve, offer],
  );

  // Handle favorite action
  const handleFavorite = useCallback(
    (event: any) => {
      event.stopPropagation();
      if (!disabled && !loading && onFavorite) {
        onFavorite(offer);
      }
    },
    [disabled, loading, onFavorite, offer],
  );

  // Handle share action
  const handleShare = useCallback(
    (event: any) => {
      event.stopPropagation();
      if (!disabled && !loading && onShare) {
        onShare(offer);
      }
    },
    [disabled, loading, onShare, offer],
  );

  // Handle establishment press
  const handleEstablishmentPress = useCallback(
    (event: any) => {
      event.stopPropagation();
      if (!disabled && !loading && onViewEstablishment) {
        onViewEstablishment(offer.establishmentId);
      }
    },
    [disabled, loading, onViewEstablishment, offer.establishmentId],
  );

  // Get layout dimensions
  const getLayoutStyles = useMemo(() => {
    const isHorizontal = orientation === 'horizontal';
    const isCompact = layout === 'compact';

    return {
      container: {
        flexDirection: isHorizontal ? 'row' : ('column' as const),
        minHeight: isCompact ? 120 : isHorizontal ? 140 : 200,
      },
      image: {
        width: (isHorizontal ? 120 : '100%') as any,
        height: (isHorizontal ? '100%' : isCompact ? 80 : 120) as any,
        aspectRatio: isHorizontal ? 1 : imageAspectRatio,
      },
      content: {
        flex: 1,
        padding: theme.spacing.base.md,
      },
    };
  }, [orientation, layout, imageAspectRatio, theme.spacing.base.md]);

  // Format pickup time
  const formatPickupTime = useMemo(() => {
    if (!offer.pickupTimeStart || !offer.pickupTimeEnd) return null;

    // Simple time formatting (would use proper date library in production)
    const start = offer.pickupTimeStart.slice(-5); // Get last 5 chars (HH:MM)
    const end = offer.pickupTimeEnd.slice(-5);
    return `${start} - ${end}`;
  }, [offer.pickupTimeStart, offer.pickupTimeEnd]);

  // Render image section
  const renderImage = () => (
    <View style={getLayoutStyles.image}>
      {offer.imageUri ? (
        <Image
          source={{ uri: offer.imageUri }}
          style={[
            {
              width: '100%',
              height: '100%',
              borderRadius: orientation === 'horizontal' ? theme.spacing.radius.md : 0,
            },
            imageStyle,
          ]}
          resizeMode='cover'
          testID={`${testID}-image`}
        />
      ) : (
        <View
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: theme.colors.surfaceVariant,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: orientation === 'horizontal' ? theme.spacing.radius.md : 0,
          }}
        >
          <Text variant='body.small' color={theme.colors.onSurfaceVariant}>
            No Image
          </Text>
        </View>
      )}

      {/* Overlay tags */}
      <View
        style={{
          position: 'absolute',
          top: theme.spacing.base.sm,
          left: theme.spacing.base.sm,
          flexDirection: 'row',
          gap: theme.spacing.base.xs,
        }}
      >
        {offer.freshnessLevel && (
          <FoodTag variant='freshness' freshnessLevel={offer.freshnessLevel} size='xs'>
            {offer.freshnessLevel}
          </FoodTag>
        )}
        {offer.isReserved && (
          <FoodTag variant='status' size='xs' backgroundColor={theme.colors.warning}>
            Reserved
          </FoodTag>
        )}
      </View>

      {/* Action buttons overlay */}
      {(showFavorite || showShare) && (
        <View
          style={{
            position: 'absolute',
            top: theme.spacing.base.sm,
            right: theme.spacing.base.sm,
            flexDirection: 'column',
            gap: theme.spacing.base.xs,
          }}
        >
          {showFavorite && (
            <Pressable
              onPress={handleFavorite}
              style={{
                padding: theme.spacing.base.xs,
                backgroundColor: theme.colors.overlay.light,
                borderRadius: theme.spacing.radius.full,
              }}
              testID={`${testID}-favorite`}
              accessibilityRole='button'
              accessibilityLabel={offer.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <FavoriteIcon filled={offer.isFavorite || false} />
            </Pressable>
          )}

          {showShare && (
            <Pressable
              onPress={handleShare}
              style={{
                padding: theme.spacing.base.xs,
                backgroundColor: theme.colors.overlay.light,
                borderRadius: theme.spacing.radius.full,
              }}
              testID={`${testID}-share`}
              accessibilityRole='button'
              accessibilityLabel='Share offer'
            >
              <ShareIcon />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  // Render establishment info
  const renderEstablishment = () => {
    if (!showEstablishment) return null;

    return (
      <Pressable
        onPress={handleEstablishmentPress}
        style={{ marginBottom: theme.spacing.base.xs }}
        testID={`${testID}-establishment`}
        accessibilityRole='button'
        accessibilityLabel={`View ${offer.establishmentName}`}
      >
        <Text variant='body.small' color={theme.colors.primary} numberOfLines={1}>
          {offer.establishmentName}
        </Text>
      </Pressable>
    );
  };

  // Render title and description
  const renderContent = () => (
    <View style={{ flex: 1, marginBottom: theme.spacing.base.sm }}>
      <Text
        variant={layout === 'compact' ? 'body.medium' : 'title.small'}
        numberOfLines={titleLines}
        style={{ marginBottom: theme.spacing.base.xs }}
        testID={`${testID}-title`}
      >
        {offer.title}
      </Text>

      {offer.description && showDetails && (
        <Text
          variant='body.small'
          color={theme.colors.onSurfaceVariant}
          numberOfLines={descriptionLines}
          style={{ marginBottom: theme.spacing.base.sm }}
          testID={`${testID}-description`}
        >
          {offer.description}
        </Text>
      )}

      {/* Tags */}
      {offer.dietaryTags && offer.dietaryTags.length > 0 && showDetails && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.base.xs,
            marginBottom: theme.spacing.base.sm,
          }}
        >
          {offer.dietaryTags.slice(0, 3).map((tag, index) => (
            <FoodTag key={index} variant='dietary' size='xs'>
              {tag}
            </FoodTag>
          ))}
        </View>
      )}
    </View>
  );

  // Render meta information
  const renderMeta = () => {
    if (!showDetails) return null;

    const metaItems = [];

    // Pickup time
    if (showPickupTime && formatPickupTime) {
      metaItems.push(
        <View key='pickup' style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ClockIcon />
          <Text
            variant='body.small'
            color={theme.colors.onSurfaceVariant}
            style={{ marginLeft: theme.spacing.base.xs }}
          >
            {formatPickupTime}
          </Text>
        </View>,
      );
    }

    // Distance
    if (showDistance && offer.distance) {
      metaItems.push(
        <View key='distance' style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LocationIcon />
          <Text
            variant='body.small'
            color={theme.colors.onSurfaceVariant}
            style={{ marginLeft: theme.spacing.base.xs }}
          >
            {offer.distance.toFixed(1)}km
          </Text>
        </View>,
      );
    }

    // Rating
    if (showRating && offer.rating) {
      metaItems.push(
        <View key='rating' style={{ flexDirection: 'row', alignItems: 'center' }}>
          <StarIcon filled />
          <Text
            variant='body.small'
            color={theme.colors.onSurfaceVariant}
            style={{ marginLeft: theme.spacing.base.xs }}
          >
            {offer.rating.toFixed(1)}
            {offer.reviewCount && ` (${offer.reviewCount})`}
          </Text>
        </View>,
      );
    }

    if (metaItems.length === 0) return null;

    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.base.sm,
          flexWrap: 'wrap',
          gap: theme.spacing.base.sm,
        }}
      >
        {metaItems}
      </View>
    );
  };

  // Render price and actions
  const renderFooter = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <PriceDisplay
        price={offer.price}
        {...(offer.originalPrice !== undefined && { originalPrice: offer.originalPrice })}
        {...(offer.currency !== undefined && { currency: offer.currency })}
        size={layout === 'compact' ? 'sm' : 'md'}
        showSavings
        testID={`${testID}-price`}
      />

      {showActions && (
        <Button
          variant={offer.isReserved ? 'outline' : 'primary'}
          size={layout === 'compact' ? 'sm' : 'md'}
          onPress={handleReserve}
          disabled={disabled || loading || offer.availableQuantity === 0}
          loading={loading}
          testID={`${testID}-reserve`}
        >
          {offer.isReserved
            ? 'Reserved'
            : offer.availableQuantity === 0
              ? 'Sold Out'
              : reserveButtonText}
        </Button>
      )}
    </View>
  );

  // Accessibility label
  const getAccessibilityLabel = useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;

    return `Food offer: ${offer.title} from ${offer.establishmentName}, price ${offer.price} ${offer.currency}${offer.originalPrice ? `, was ${offer.originalPrice}` : ''}`;
  }, [accessibilityLabel, offer]);

  return (
    <Card
      variant='elevated'
      pressable={!!onPress}
      onPress={handleCardPress}
      loading={loading}
      disabled={disabled}
      style={[getLayoutStyles.container, style]}
      testID={testID}
      accessibilityLabel={getAccessibilityLabel}
      {...(onPress && { accessibilityRole: 'button' as const })}
      {...rest}
    >
      {renderImage()}

      <View style={[getLayoutStyles.content, contentStyle]}>
        {renderEstablishment()}
        {renderContent()}
        {renderMeta()}
        {renderFooter()}
      </View>
    </Card>
  );
};

export default FoodCard;
