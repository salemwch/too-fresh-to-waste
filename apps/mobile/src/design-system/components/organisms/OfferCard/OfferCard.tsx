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

import IoniconsIcon from '@react-native-vector-icons/ionicons';
import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import FastImage from 'react-native-fast-image';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

import { CtaState } from '@/features/offers/types';
import { haptic } from '@/utils/haptics';
import { getOptimizedImageUrl, IMAGE_PRESETS } from '@/utils/imageTransform';
import { Logger } from '@/utils/logger';

import { useTheme } from '../../../providers';
import { colorTokens } from '../../../tokens/colors';
import { Badge } from '../../atoms/Badge';
import { Card } from '../../atoms/Card';
import { ShimmerBlock } from '../../atoms/ShimmerBlock/ShimmerBlock';
import { Text } from '../../atoms/Text';
import { useShimmerAnimation } from '../../atoms/ShimmerBlock/useShimmerAnimation';

import {
  formatPickupTime,
  formatDistance,
  formatStartTime,
  offerTypeLabels,
} from './OfferCard.types';

import type { MascotVariant, OfferCardProps } from './OfferCard.types';

/**
 * Placeholder image for missing offer images
 */
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300/E5E7EB/9CA3AF?text=No+Image';

/**
 * Color constants for OfferCard component
 * Extracted to comply with react-native/no-color-literals rule
 */
const COLORS = {
  HEART_DEFAULT: colorTokens.base.primary[500], // ✅ Brand green for filled heart
  HEART_UNFILLED: '#9CA3AF',
  ITEMS_LEFT_BG: '#fbf9be',
  ITEMS_LEFT_TEXT: colorTokens.base.primary[500],
  WHITE: '#FFFFFF',
  BLACK: '#000',
  SOLD_OUT_OVERLAY: 'rgba(0, 0, 0, 0.5)',
  NOT_STARTED_OVERLAY: 'rgba(0, 82, 80, 0.45)', // Brand teal overlay for not-yet-available
} as const;

// ── Mascot configuration ─────────────────────────────────────────────────────

const MASCOT_CONFIG: Record<MascotVariant, { color: string }> = {
  urgent: { color: colorTokens.base.error[500] },
  hottest: { color: '#D97706' },
  today: { color: '#16A34A' },
  tomorrow: { color: '#6366F1' },
};

const BagMascotSvg: React.FC<{ variant: MascotVariant }> = ({ variant }) => (
  <Svg width={44} height={52} viewBox='0 0 44 52'>
    {/* Handle */}
    <Path
      d='M15 20 Q15 8 22 8 Q29 8 29 20'
      stroke='white'
      strokeWidth='3'
      fill='none'
      strokeLinecap='round'
    />
    {/* Bag body */}
    <Rect x='3' y='18' width='38' height='32' rx='9' fill='white' fillOpacity={0.95} />
    {/* Shine highlight */}
    <Ellipse
      cx='11'
      cy='24'
      rx='5'
      ry='2.5'
      fill='white'
      fillOpacity={0.3}
      transform='rotate(-20 11 24)'
    />

    {variant === 'urgent' && (
      <G>
        {/* Worried brows */}
        <Path
          d='M11 27 Q14 24 17 26'
          stroke={colorTokens.base.error[500]}
          strokeWidth='2'
          fill='none'
          strokeLinecap='round'
        />
        <Path
          d='M27 26 Q30 24 33 27'
          stroke={colorTokens.base.error[500]}
          strokeWidth='2'
          fill='none'
          strokeLinecap='round'
        />
        {/* Eyes */}
        <Circle cx='14' cy='31' r='4' fill='#FCA5A5' />
        <Circle cx='30' cy='31' r='4' fill='#FCA5A5' />
        <Circle cx='13.5' cy='30' r='2.2' fill='#7F1D1D' />
        <Circle cx='29.5' cy='30' r='2.2' fill='#7F1D1D' />
        {/* Frown */}
        <Path
          d='M15 42 Q22 37 29 42'
          stroke={colorTokens.base.error[500]}
          strokeWidth='2.5'
          fill='none'
          strokeLinecap='round'
        />
        {/* Tear drop */}
        <Ellipse cx='12' cy='37' rx='1.8' ry='2.8' fill='#93C5FD' fillOpacity={0.9} />
        {/* Sweat drop top-right */}
        <Ellipse cx='37' cy='22' rx='2' ry='3' fill='#BFDBFE' fillOpacity={0.85} />
      </G>
    )}

    {variant === 'hottest' && (
      <G>
        {/* Sunglass lenses */}
        <Rect x='8' y='27' rx='4' ry='4' width='12' height='9' fill='#1a1a1a' />
        <Rect x='24' y='27' rx='4' ry='4' width='12' height='9' fill='#1a1a1a' />
        {/* Bridge + arms */}
        <Rect x='20' y='30' width='4' height='3' fill='#1a1a1a' />
        <Rect x='5' y='30' width='3' height='2' rx='1' fill='#1a1a1a' />
        <Rect x='36' y='30' width='3' height='2' rx='1' fill='#1a1a1a' />
        {/* Lens shine */}
        <Rect x='9' y='28' width='4' height='2' rx='1' fill='white' fillOpacity={0.45} />
        <Rect x='25' y='28' width='4' height='2' rx='1' fill='white' fillOpacity={0.45} />
        {/* Smirk */}
        <Path
          d='M17 41 Q24 47 31 41'
          stroke='#D97706'
          strokeWidth='2.5'
          fill='none'
          strokeLinecap='round'
        />
      </G>
    )}

    {variant === 'today' && (
      <G>
        {/* Happy eyes */}
        <Circle cx='15' cy='30' r='4.5' fill='#BBF7D0' />
        <Circle cx='29' cy='30' r='4.5' fill='#BBF7D0' />
        <Circle cx='15' cy='30' r='2.5' fill='#14532D' />
        <Circle cx='29' cy='30' r='2.5' fill='#14532D' />
        {/* Sparkle highlights */}
        <Circle cx='16.5' cy='28.5' r='1' fill='white' />
        <Circle cx='30.5' cy='28.5' r='1' fill='white' />
        {/* Wide smile */}
        <Path
          d='M12 39 Q22 49 32 39'
          stroke='#16A34A'
          strokeWidth='3'
          fill='none'
          strokeLinecap='round'
        />
      </G>
    )}

    {variant === 'tomorrow' && (
      <G>
        {/* Nightcap */}
        <Polygon points='22,2 13,21 31,21' fill='#4338CA' />
        <Rect x='12' y='19' width='20' height='5' rx='2.5' fill='#4F46E5' />
        <Circle cx='22' cy='3' r='3' fill='white' fillOpacity={0.9} />
        {/* Sleeping eyes (closed arcs) */}
        <Path
          d='M10 30 Q15 26 20 30'
          stroke='#6366F1'
          strokeWidth='2.5'
          fill='none'
          strokeLinecap='round'
        />
        <Path
          d='M24 30 Q29 26 34 30'
          stroke='#6366F1'
          strokeWidth='2.5'
          fill='none'
          strokeLinecap='round'
        />
        {/* Drooping mouth */}
        <Path
          d='M18 40 Q22 38 26 40'
          stroke='#818CF8'
          strokeWidth='2'
          fill='none'
          strokeLinecap='round'
        />
      </G>
    )}
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────

const HeartIcon: React.FC<{ filled: boolean; size?: number; color?: string }> = ({
  filled,
  size = 20,
  color = COLORS.HEART_DEFAULT,
}) => (
  <IoniconsIcon
    name={filled ? 'heart' : 'heart-outline'}
    size={size}
    color={filled ? color : COLORS.HEART_UNFILLED}
  />
);
/**
 * OfferCard Component
 */
const OfferCardComponent: React.FC<OfferCardProps> = ({
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
  mascotVariant,
  mascotCopy,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme, orientation, layout, imageAspectRatio);

  // ==================== Image shimmer placeholder ====================
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [useRawUrl, setUseRawUrl] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const shimmerAnim = useShimmerAnimation('gradient', !isImageLoaded);

  // Reset shimmer when FlashList recycles this cell for a different offer
  useEffect(() => {
    setIsImageLoaded(false);
    setUseRawUrl(false);
    setLogoLoadFailed(false);
  }, [offer.image]);

  // ✅ PERFORMANCE: Debug logs removed (use React DevTools Profiler instead)

  // ==================== Computed Values ====================
  // ✅ Backend provides availableQuantity (totalQuantity - sold - reserved)
  const itemsLeft = offer.availableQuantity;
  const pickupTime = useMemo(
    () => formatPickupTime(offer.pickupTimeSlots, offer.availableUntil),
    [offer.pickupTimeSlots, offer.availableUntil],
  );
  const distanceText = useMemo(() => formatDistance(offer.distance), [offer.distance]);
  const isOutOfStock = itemsLeft <= 0;
  const isNotStarted = offer.ctaState === CtaState.NOT_STARTED;
  const startTimeText = useMemo(
    () => (isNotStarted ? formatStartTime(offer.availableFrom) : null),
    [isNotStarted, offer.availableFrom],
  );

  // Image source with fallback: optimized URL → raw URL → placeholder
  const imageSource = useMemo(() => {
    const rawUri = offer.image ?? PLACEHOLDER_IMAGE;
    const uri = useRawUrl
      ? rawUri
      : (getOptimizedImageUrl(rawUri, IMAGE_PRESETS.listCard) ?? rawUri);
    return { uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable };
  }, [offer.image, useRawUrl]);

  // Get establishment rating for display
  const hasRating = useMemo(
    () => offer.establishment?.averageRating !== undefined && offer.establishment.averageRating > 0,
    [offer.establishment?.averageRating],
  );

  // ==================== Handlers ====================
  const handleCardPress = useCallback(() => {
    if (__DEV__) {
      Logger.debug('[OfferCard] handleCardPress called', {
        offerId: offer.id,
        disabled,
        loading,
        hasOnPress: !!onPress,
        isOutOfStock,
        availableQuantity: offer.availableQuantity,
      });
    }
    if (!disabled && !loading && onPress) {
      onPress(offer);
    }
  }, [disabled, loading, onPress, offer, isOutOfStock]);

  const handleFavoritePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      if (!disabled && !loading && onFavorite) {
        haptic('selection');
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
    if (isNotStarted && startTimeText !== null) {
      label += `, starts at ${startTimeText}`;
    } else if (itemsLeft > 0) {
      label += `, ${itemsLeft} items left`;
    } else {
      label += ', Sold out';
    }

    return label;
  }, [accessibilityLabel, distanceText, isNotStarted, itemsLeft, offer, startTimeText]);

  // ==================== Render Functions ====================

  /**
   * Render image section with overlays
   */
  const renderImage = () => (
    <View
      style={[
        styles.imageContainer,
        imageStyle,
        mascotVariant != null ? styles.imageContainerWithStrip : undefined,
      ]}
    >
      <FastImage
        source={imageSource}
        style={styles.image}
        resizeMode={FastImage.resizeMode.cover}
        accessibilityIgnoresInvertColors
        onLoad={() => setIsImageLoaded(true)}
        onError={() => {
          if (!useRawUrl && offer.image) {
            setUseRawUrl(true);
          } else {
            setIsImageLoaded(true);
          }
        }}
      />
      {!isImageLoaded && (
        <ShimmerBlock
          animValue={shimmerAnim}
          width='100%'
          height='100%'
          borderRadius={10}
          style={styles.imageShimmer}
        />
      )}

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
          {!logoLoadFailed &&
          offer.establishment.profileImage !== null &&
          offer.establishment.profileImage !== undefined &&
          offer.establishment.profileImage.length > 0 ? (
            <FastImage
              source={{
                uri: offer.establishment.profileImage,
                priority: FastImage.priority.low,
                cache: FastImage.cacheControl.immutable,
              }}
              style={styles.logoImage}
              resizeMode={FastImage.resizeMode.cover}
              accessibilityIgnoresInvertColors
              onError={() => setLogoLoadFailed(true)}
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

      {/* Not started overlay — shown instead of sold out when offer hasn't begun */}
      {isNotStarted && startTimeText !== null && (
        <View style={styles.notStartedOverlay}>
          <Badge variant='info' size='md' label={`Starts at ${startTimeText}`} />
        </View>
      )}

      {/* Sold out overlay — only when truly out of stock, not when not started */}
      {isOutOfStock && !isNotStarted && (
        <View style={styles.soldOutOverlay}>
          <Badge variant='error' size='md' label={t('offers.soldOut')} />
        </View>
      )}

      {/* Expired overlay (for favorites view) */}
      {offer.status === 'expired' && (
        <View style={styles.expiredOverlay}>
          <Badge variant='warning' size='md' label={t('offers.expired')} />
        </View>
      )}

      {/* Pick-Up Only banner — shop is outside 5 km delivery zone */}
      {offer.distance !== undefined && offer.distance > 5000 && (
        <View style={styles.pickupOnlyBanner}>
          <Text variant='label.small' style={styles.pickupOnlyText}>
            🚶 Pick-Up Only
          </Text>
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
        <Pressable
          onPress={handleEstablishmentPress}
          disabled={!onEstablishmentPress}
          accessibilityRole='button'
          accessibilityLabel={t('offers.a11yViewEstablishment', { name: offer.establishment.name })}
          accessibilityHint={t('offers.a11yEstablishmentHint')}
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
        </Pressable>

        {/* Favorite button moved to content section */}
        {showFavorite && (
          <Pressable
            onPress={handleFavoritePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole='button'
            accessibilityLabel={
              isFavorite ? t('offers.a11yRemoveFavorite') : t('offers.a11yAddFavorite')
            }
            accessibilityHint={
              isFavorite ? t('offers.a11yRemoveFavoriteHint') : t('offers.a11yAddFavoriteHint')
            }
            style={styles.favoriteButtonContent}
          >
            <HeartIcon filled={isFavorite} size={20} />
          </Pressable>
        )}
      </View>
    );
  };

  const renderTitle = () => (
    <View style={styles.titleContainer}>
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>{offerTypeLabels[offer.type]}</Text>
      </View>
      <Text
        variant='body.small'
        color={theme.colors.onSurface}
        numberOfLines={1}
        style={styles.title}
      >
        {offer.title}
      </Text>
    </View>
  );

  /**
   * Render pickup time with distance
   */
  const renderPickupTime = () => {
    if (!showPickupTime) return null;

    const hasPickupTime = pickupTime !== null && pickupTime !== undefined && pickupTime.length > 0;
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
    const priceColor =
      mascotVariant != null ? MASCOT_CONFIG[mascotVariant].color : theme.colors.primary;

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
          <Text variant='body.medium' weight='bold' color={priceColor} style={styles.currentPrice}>
            {offer.pricing.currency}
            {offer.pricing.discountedPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Solid-color personality strip with bag mascot — shown only when mascotVariant is set
   */
  const renderMascotStrip = () => {
    if (mascotVariant == null || mascotCopy == null) return null;
    const config = MASCOT_CONFIG[mascotVariant];
    return (
      <View style={[styles.mascotStrip, { backgroundColor: config.color }]}>
        <BagMascotSvg variant={mascotVariant} />
        <Text variant='label.small' style={styles.mascotCopy} numberOfLines={3}>
          {mascotCopy}
        </Text>
      </View>
    );
  };

  // ==================== Main Render ====================
  return (
    <Card
      variant='elevated'
      pressable={!!onPress && !disabled && !loading}
      pressGuardMs={400}
      onPress={handleCardPress}
      disabled={disabled || (isOutOfStock && !isNotStarted)}
      style={[styles.card, style]}
      testID={testID}
      accessibilityLabel={accessibilityLabelText}
      accessibilityHint={accessibilityHint ?? 'Double tap to view offer details'}
      accessibilityRole='button'
    >
      {renderImage()}
      {renderMascotStrip()}

      <View style={[styles.content, contentStyle]}>
        {renderEstablishment()}
        {renderTitle()}
        {renderPickupTime()}
        {renderBottomRow()}
      </View>
    </Card>
  );
};

OfferCardComponent.displayName = 'OfferCard';

export const OfferCard = memo(OfferCardComponent);

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
      minWidth: isHorizontal ? 160 : 170,
      maxWidth: isHorizontal ? 180 : 270,
      borderRadius: 20,
      padding: 5,
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
    imageShimmer: {
      position: 'absolute',
      top: 0,
      insetInlineStart: 0,
    },
    topLeftBadges: {
      position: 'absolute',
      top: theme.spacing.base.sm,
      insetInlineStart: theme.spacing.base.sm,
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
      insetInlineEnd: theme.spacing.base.sm,
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
      insetInlineStart: theme.spacing.base.sm,
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
    notStartedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.NOT_STARTED_OVERLAY,
      justifyContent: 'center',
      alignItems: 'center',
    },
    soldOutOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.SOLD_OUT_OVERLAY,
      justifyContent: 'center',
      alignItems: 'center',
    },
    expiredOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.SOLD_OUT_OVERLAY,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    pickupOnlyBanner: {
      position: 'absolute',
      bottom: 0,
      insetInlineStart: 0,
      insetInlineEnd: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      paddingVertical: 4,
      alignItems: 'center',
      zIndex: 5,
    },
    pickupOnlyText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    imageContainerWithStrip: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    mascotStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 7,
      gap: 8,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      minHeight: 62,
    },
    mascotCopy: {
      flex: 1,
      color: COLORS.WHITE,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
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
      marginEnd: -4,
    },
    titleContainer: {
      // Badge and title share one line. flexDirection 'row' flips automatically
      // under RTL, so Arabic needs no special case.
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    typeBadge: {
      // Must not shrink: without this flexbox compresses the badge before the
      // title, wrapping "Surprise Bag" onto two lines inside its own pill.
      flexShrink: 0,
      backgroundColor: colorTokens.base.primary[50],
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    typeBadgeText: {
      // Sized down now that the badge sits inline with the title: it is a
      // secondary qualifier, so it should not compete with the offer name for
      // attention. Tighter letterSpacing matters more than font size here —
      // uppercase + 0.5 spacing is what made "SPECIFIC ITEMS" read as a wide
      // block. Kept at 8pt rather than lower because it is all-caps at 700
      // weight, which stays legible where lowercase body text would not.
      fontSize: 8,
      fontWeight: '700',
      color: colorTokens.base.primary[500],
      textTransform: 'uppercase',
      letterSpacing: 0.2,
    },
    // flexShrink lets a long title ellipsize (numberOfLines={1}) instead of
    // pushing the badge past the card edge.
    title: {
      flexShrink: 1,
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
