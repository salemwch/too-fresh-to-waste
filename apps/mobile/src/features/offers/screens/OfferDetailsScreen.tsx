import IoniconsIcon from '@react-native-vector-icons/ionicons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  ScrollView,
  Dimensions,
  Pressable,
  TouchableWithoutFeedback,
  Animated,
  Linking,
  Alert,
  Easing,
  InteractionManager,
  I18nManager,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, Button } from '@/design-system/components/atoms';
import { mirrorIconName } from '@/design-system/components/atoms/Icon/rtlMirror';
import { useTheme } from '@/design-system/providers';

import { useFavoriteToggle } from '@/features/favorites/hooks';
import { analytics } from '@/utils/analytics';

import { styles, PRIMARY_COLOR, WHITE, INDIGO } from './OfferDetailsScreen.styles';
import { Logger } from '@/utils/logger';

import { ReviewSummarySection } from '../components/ReviewSummarySection';
import { SkeletonOfferDetails } from '../components/SkeletonOfferDetails';
import { useOffer } from '../hooks/useOffers';
import { isOfferActive, OfferStatus } from '../types/offer.types';

import type { Offer } from '../types/offer.types';
import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colorTokens } from '@/design-system/tokens/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type OfferDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OfferDetails'
>;
type OfferDetailsScreenRouteProp = RouteProp<MainStackParamList, 'OfferDetails'>;

interface OfferDetailsScreenProps {
  navigation: OfferDetailsScreenNavigationProp;
  route: OfferDetailsScreenRouteProp;
}

type OfferDetailsTheme = ReturnType<typeof useTheme>;

interface ReserveBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  offer: Offer;
  theme: OfferDetailsTheme;
}

// ─────────────────────────────────────────────────────────────────────────
// Animated Bottom Sheet Sub-Component (Custom Overlay - Best Practice)
// ─────────────────────────────────────────────────────────────────────────
const ReserveBottomSheet: React.FC<ReserveBottomSheetProps> = ({
  visible,
  onClose,
  onConfirm,
  offer,
  theme,
}) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [slideAnim] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const establishment =
    typeof offer.establishmentId === 'object' && offer.establishmentId !== null
      ? offer.establishmentId
      : undefined;
  const modalHeaderStyle = { backgroundColor: theme.colors.primary };
  const qtyButtonStyle = { backgroundColor: theme.colors.primary };
  const termsLinkColorStyle = { color: theme.colors.primary };

  useEffect(() => {
    if (visible) {
      // ✅ Smooth, gentle animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth ease-out curve
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations when not visible
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          easing: Easing.bezier(0.42, 0, 0.58, 1), // Smooth ease-in-out
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        easing: Easing.bezier(0.42, 0, 0.58, 1), // Smooth ease-in-out
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  const discountedPrice = offer.pricing?.discountedPrice ?? 0;
  const total = (discountedPrice * quantity).toFixed(2);

  // Get establishment name
  const establishmentName = establishment?.name ?? 'Establishment';

  // Get pickup time slot
  const pickupSlot = offer.pickupTimeSlots?.[0];
  const pickupTime = pickupSlot ? `${pickupSlot.startTime} - ${pickupSlot.endTime}` : '';
  const handleTermsPress = () => {
    Alert.alert(t('offers.termsConditions'), t('offers.termsAlert'));
  };

  return (
    <View style={styles.modalOverlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop - covers screen content, not navigation header */}
      <TouchableWithoutFeedback accessibilityRole='button' onPress={handleClose}>
        <Animated.View
          style={[
            styles.modalBackdrop,
            {
              opacity: fadeAnim,
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Bottom sheet content */}
      <Animated.View
        style={[
          styles.modalContent,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header with establishment name */}
        <View style={[styles.modalHeader, modalHeaderStyle]}>
          <Text weight='bold' style={styles.modalHeaderTitle}>
            {establishmentName}
          </Text>
          <Text size='sm' style={styles.modalHeaderSubtitle}>
            {offer.type.replace('_', ' ')}
          </Text>
          <View style={styles.modalTimeRow}>
            <IoniconsIcon name='time' color={WHITE} size={16} />
            <Text size='sm' style={styles.modalTimeText}>
              {t('offers.pickupTime')}: {pickupTime}
            </Text>
          </View>
        </View>

        <View style={styles.modalBody}>
          <Text align='center' color='secondary' size='sm' style={styles.quantityLabel}>
            {t('offers.selectQuantity')}
          </Text>

          {/* Quantity controls */}
          <View style={styles.quantityControls}>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={t('offers.a11yDecreaseQuantity')}
              accessibilityHint={t('offers.a11yDecreaseQuantityHint')}
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
              style={[styles.qtyButton, qtyButtonStyle]}
            >
              <IoniconsIcon name='remove' color={WHITE} size={20} />
            </Pressable>
            <Text weight='bold' size='xl'>
              {quantity}
            </Text>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={t('offers.a11yIncreaseQuantity')}
              accessibilityHint={t('offers.a11yIncreaseQuantityHint')}
              onPress={() => setQuantity(q => Math.min(offer.availableQuantity ?? 1, q + 1))}
              style={[styles.qtyButton, qtyButtonStyle]}
            >
              <IoniconsIcon name='add' color={WHITE} size={20} />
            </Pressable>
          </View>

          {/* Terms & Conditions */}
          <View style={styles.termsContainer}>
            <Text size='xs' color='secondary' align='center' style={styles.termsText}>
              {t('offers.termsPrefix')}{' '}
              <Text
                size='xs'
                weight='semibold'
                style={[styles.termsLink, termsLinkColorStyle]}
                onPress={handleTermsPress}
              >
                {t('offers.termsConditions')}
              </Text>
            </Text>
          </View>

          <View style={styles.modalDivider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text size='md'>{t('common.total')}</Text>
            <Text weight='bold' size='lg'>
              {total} {offer.pricing.currency}
            </Text>
          </View>

          {/* Reserve button */}
          <Button
            variant='primary'
            size='lg'
            style={styles.reserveButtonSpacing}
            onPress={() => onConfirm(quantity)}
          >
            {t('offers.reserveNow')}
          </Button>
        </View>
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────
export const OfferDetailsScreen: React.FC<OfferDetailsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { offerId } = route.params;
  const { data: offer, isLoading, error, refetch } = useOffer(offerId);
  const establishment =
    typeof offer?.establishmentId === 'object' && offer.establishmentId !== null
      ? offer.establishmentId
      : undefined;

  const reviewEstablishmentId: string =
    (establishment as { _id?: string; id?: string } | undefined)?._id ??
    (establishment as { _id?: string; id?: string } | undefined)?.id ??
    (typeof offer?.establishmentId === 'string' ? offer.establishmentId : '');
  const merchant =
    typeof offer?.merchantId === 'object' && offer.merchantId !== null
      ? offer.merchantId
      : undefined;

  // isFavorite comes from the same hook that writes it, so the heart and the
  // optimistic cache patch cannot disagree.
  const {
    toggle: toggleFavorite,
    isLoading: isFavoriteLoading,
    isFavorite,
  } = useFavoriteToggle(offerId, offer?.title, offer?.images?.[0]);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [isAllergensOpen, setIsAllergensOpen] = useState(false);
  const [isSheetVisible, setSheetVisible] = useState(false);

  // Fire once when offer data arrives — deferred until after navigation animation completes
  useEffect(() => {
    if (offer === undefined) return;
    const task = InteractionManager.runAfterInteractions(() => {
      analytics.trackOfferViewed(offerId, offer.title, offer.pricing.discountedPrice);
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?._id, offer?.id, offerId]);

  if (isLoading) {
    return <SkeletonOfferDetails />;
  }

  if (error !== null || offer === undefined) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text weight='bold' color='error'>
          ⚠️ {t('offers.errorLoading')}
        </Text>
        <Button
          variant='primary'
          style={styles.retryButton}
          onPress={() => {
            void refetch();
          }}
        >
          {t('common.retry')}
        </Button>
      </View>
    );
  }

  const canReserve = isOfferActive(offer) && (offer.availableQuantity ?? 0) > 0;
  const isNotStarted =
    offer.status === OfferStatus.ACTIVE &&
    offer.isActive &&
    offer.isExpired !== true &&
    offer.isSoldOut !== true &&
    new Date() < new Date(offer.availableFrom);

  let startTimeText: string | null = null;
  if (isNotStarted && offer.availableFrom) {
    try {
      startTimeText = new Date(offer.availableFrom).toLocaleTimeString('en-US', {
        timeZone: 'Africa/Tunis',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      startTimeText = null;
    }
  }

  const pickupDayLabel = (() => {
    try {
      const toTunisDate = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'Africa/Tunis' });
      const offerDay = toTunisDate(new Date(offer.availableFrom));
      const todayStr = toTunisDate(new Date());
      const tomorrowStr = toTunisDate(new Date(Date.now() + 86400000));
      if (offerDay === tomorrowStr) return t('common.tomorrow');
      if (offerDay === todayStr) return t('common.today');
      return t('common.today');
    } catch {
      return t('common.today');
    }
  })();

  const todayBadgeStyle = { backgroundColor: theme.colors.primary };
  const footerStyle = { borderTopColor: theme.colors.outlineVariant };
  const reserveButtonStyle = {
    backgroundColor: isNotStarted ? INDIGO : theme.colors.primary,
    opacity: canReserve ? 1 : 0.6,
  };

  const handleConfirmReservation = (qty: number) => {
    setSheetVisible(false);
    // ✅ BUGFIX: Backend aggregation returns _id, frontend expects id
    navigation.navigate('Checkout', { offerId: offer._id ?? offer.id, quantity: qty });
  };

  /**
   * Opens Google Maps with establishment location
   * Uses coordinates from establishment.address.coordinates
   * Format: [longitude, latitude] (GeoJSON standard)
   */
  const handleOpenMaps = async () => {
    try {
      if (typeof offer.establishmentId !== 'object' || !offer.establishmentId?.address) {
        Alert.alert(t('offers.locationUnavailable'), t('offers.locationNotAvailable'));
        return;
      }

      const { address } = offer.establishmentId;

      // Verify coordinates exist and are valid
      if (address.coordinates?.coordinates?.length !== 2) {
        Alert.alert(t('offers.locationUnavailable'), t('offers.locationCoordsNotAvailable'));
        return;
      }

      // GeoJSON format: [longitude, latitude]
      const [longitude, latitude] = address.coordinates.coordinates;

      // Validate coordinates
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        Alert.alert(t('offers.locationUnavailable'), t('offers.locationError'));
        return;
      }

      // Google Maps URL with coordinates
      // Using search API to ensure compatibility with both web and app
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

      // Check if the URL can be opened
      const canOpen = await Linking.canOpenURL(googleMapsUrl);

      if (canOpen) {
        await Linking.openURL(googleMapsUrl);
      } else {
        Alert.alert(t('errors.generic'), t('offers.mapsError'));
      }
    } catch (mapsError) {
      Logger.error('Error opening maps', {}, mapsError instanceof Error ? mapsError : undefined);
      Alert.alert(t('errors.generic'), t('offers.mapsOpenFailed'));
    }
  };
  const handleOpenMapsPress = () => {
    void handleOpenMaps();
  };
  const handleFavoritePress = () => {
    void toggleFavorite();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* --- Header Section --- */}
        <View style={styles.headerContainer}>
          <FastImage
            source={{
              uri: offer.images?.[0] ?? '',
              priority: FastImage.priority.high,
              cache: FastImage.cacheControl.immutable,
            }}
            style={styles.headerImage}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradientOverlay}
          />

          <View style={styles.topNav}>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={t('offers.a11yBackButton')}
              accessibilityHint={t('offers.a11yBackButtonHint')}
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
            >
              <IoniconsIcon
                name={mirrorIconName('chevron-back', I18nManager.isRTL) as 'chevron-back'}
                color={colorTokens.base.neutral[900]}
                size={24}
              />
            </Pressable>
            <View style={styles.topRightActions}>
              <Pressable
                style={styles.iconButton}
                onPress={handleFavoritePress}
                disabled={isFavoriteLoading}
                accessibilityLabel={
                  isFavorite ? t('offers.removeFromFavorites') : t('offers.addToFavorites')
                }
                accessibilityHint={
                  isFavorite ? t('offers.removeFromFavorites') : t('offers.addToFavorites')
                }
                accessibilityRole='button'
              >
                <IoniconsIcon
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  color={isFavorite ? PRIMARY_COLOR : colorTokens.base.neutral[900]}
                  size={20}
                />
              </Pressable>
            </View>
          </View>

          {/* Merchant Logo - Bottom Left */}
          {(offer.establishmentId !== '' || establishment !== undefined) && (
            <View style={styles.merchantLogoContainer}>
              {merchant?.profileImage != null && merchant.profileImage.length > 0 ? (
                <FastImage
                  source={{
                    uri: merchant.profileImage,
                    priority: FastImage.priority.normal,
                    cache: FastImage.cacheControl.immutable,
                  }}
                  style={styles.merchantLogo}
                  resizeMode={FastImage.resizeMode.cover}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={styles.merchantLogoPlaceholder}>
                  <Text weight='bold' style={styles.logoPlaceholderText}>
                    {establishment?.name !== undefined
                      ? establishment.name.charAt(0).toUpperCase()
                      : 'E'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.headerTextContainer}>
            <Text weight='bold' style={styles.headerTitleText} size='xl' numberOfLines={1}>
              {establishment?.name ?? 'Establishment'}
            </Text>
            <Text style={styles.headerSubtitleText} numberOfLines={1}>
              {offer.categories?.join(' • ')}
            </Text>
          </View>
        </View>

        {/* --- Info Section --- */}
        <View style={styles.contentContainer}>
          <View style={styles.itemHeader}>
            <View style={styles.itemTitleRow}>
              <IoniconsIcon name='bag' color={theme.colors.secondary} size={20} />
              <Text weight='semibold' size='md' style={styles.offerTypeText}>
                {offer.type.replace('_', ' ')}
              </Text>
            </View>
            <View style={styles.priceContainer}>
              <Text size='md' color='secondary' style={styles.oldPrice}>
                {(offer.pricing?.originalPrice ?? 0).toFixed(2)} {offer.pricing?.currency ?? 'TND'}
              </Text>
              <Text weight='bold' size='lg' style={{ color: theme.colors.primary }}>
                {(offer.pricing?.discountedPrice ?? 0).toFixed(2)}{' '}
                {offer.pricing?.currency ?? 'TND'}
              </Text>
            </View>
          </View>

          {/* --- Rating Section --- */}
          {establishment?.averageRating != null && establishment.averageRating > 0 && (
            <View style={styles.ratingRow}>
              <IoniconsIcon name='star' color='#facc15' size={16} />
              <Text weight='semibold' size='md' style={styles.ratingText}>
                {establishment.averageRating.toFixed(1)}
              </Text>
              {establishment.totalReviews != null && establishment.totalReviews > 0 && (
                <Text size='md' color='secondary' style={styles.reviewCount}>
                  ({establishment.totalReviews})
                </Text>
              )}
            </View>
          )}

          <View style={styles.pickupRow}>
            <IoniconsIcon name='time' color={colorTokens.light.onSurfaceVariant} size={20} />
            <Text style={styles.pickupText}>
              {t('offers.pickUp')}: {offer.pickupTimeSlots?.[0]?.startTime} -{' '}
              {offer.pickupTimeSlots?.[0]?.endTime}
            </Text>
            <View style={[styles.todayBadge, todayBadgeStyle]}>
              <Text weight='bold' style={styles.todayBadgeText}>
                {pickupDayLabel}
              </Text>
            </View>
          </View>

          {offer.pickupTimeSlots?.[0]?.maxOrders != null && (
            <View style={styles.slotLimitRow}>
              <IoniconsIcon name='people' color={colorTokens.light.onSurfaceVariant} size={16} />
              <Text style={styles.slotLimitText}>
                {offer.pickupTimeSlots[0].maxOrders === 1
                  ? t('offers.slotLimit', { count: offer.pickupTimeSlots[0].maxOrders })
                  : t('offers.slotLimitPlural', { count: offer.pickupTimeSlots[0].maxOrders })}
              </Text>
            </View>
          )}

          {/* --- Location Card --- */}
          {establishment?.address !== undefined && (
            <Pressable
              accessibilityRole='button'
              style={styles.locationCard}
              onPress={handleOpenMapsPress}
            >
              <View style={styles.locationContent}>
                <View style={styles.locationIconContainer}>
                  <IoniconsIcon name='location' color={WHITE} size={16} />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text weight='semibold' style={styles.locationAddress} numberOfLines={1}>
                    {establishment.address.street}, {establishment.address.city}
                  </Text>
                  <Text size='sm' color='secondary' style={styles.locationSubtext}>
                    {t('offers.tapToViewMap')}
                  </Text>
                </View>
              </View>
              <IoniconsIcon
                name={mirrorIconName('chevron-forward', I18nManager.isRTL) as 'chevron-forward'}
                color={colorTokens.light.onSurfaceVariant}
                size={20}
              />
            </Pressable>
          )}

          <View style={styles.divider} />

          {/* --- Description Accordion --- */}
          <View style={styles.section}>
            <Pressable
              accessibilityRole='button'
              style={styles.accordionHeader}
              onPress={() => setIsDescriptionOpen(!isDescriptionOpen)}
            >
              <Text weight='semibold' size='md'>
                {t('offers.whatToKnow')}
              </Text>
              {isDescriptionOpen ? (
                <IoniconsIcon
                  name='chevron-up'
                  color={colorTokens.light.onSurfaceVariant}
                  size={20}
                />
              ) : (
                <IoniconsIcon
                  name='chevron-down'
                  color={colorTokens.light.onSurfaceVariant}
                  size={20}
                />
              )}
            </Pressable>
            {isDescriptionOpen && (
              <View style={styles.accordionContent}>
                {offer.description ? (
                  <Text color='secondary' style={styles.descriptionText}>
                    {offer.description}
                  </Text>
                ) : (
                  <>
                    <Text weight='bold' style={styles.descriptionText}>
                      {t('offers.surpriseBagTitle')}
                    </Text>
                    <Text color='secondary' style={styles.descriptionText}>
                      {t('offers.surpriseBagDescription')}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>

          {/* --- Reviews summary --- */}
          {reviewEstablishmentId.length > 0 && (
            <>
              <View style={styles.divider} />
              <ReviewSummarySection establishmentId={reviewEstablishmentId} />
            </>
          )}

          {/* --- Allergens & Dietary Accordion --- */}
          {offer.nutritionalInfo &&
            ((offer.nutritionalInfo.allergens?.length ?? 0) > 0 ||
              (offer.nutritionalInfo.dietaryInfo?.length ?? 0) > 0) && (
              <View style={styles.section}>
                <Pressable
                  accessibilityRole='button'
                  style={styles.accordionHeader}
                  onPress={() => setIsAllergensOpen(!isAllergensOpen)}
                >
                  <Text weight='semibold' size='md'>
                    {t('offers.ingredientsAllergens')}
                  </Text>
                  {isAllergensOpen ? (
                    <IoniconsIcon
                      name='chevron-up'
                      color={colorTokens.light.onSurfaceVariant}
                      size={20}
                    />
                  ) : (
                    <IoniconsIcon
                      name='chevron-down'
                      color={colorTokens.light.onSurfaceVariant}
                      size={20}
                    />
                  )}
                </Pressable>
                {isAllergensOpen && (
                  <View style={styles.accordionContent}>
                    {/* Display Allergens */}
                    {(offer.nutritionalInfo.allergens?.length ?? 0) > 0 && (
                      <View style={styles.nutritionSection}>
                        <Text weight='semibold' size='sm' style={styles.nutritionHeading}>
                          {t('offers.allergens')}
                        </Text>
                        <Text color='secondary' style={styles.nutritionBody}>
                          {offer.nutritionalInfo.allergens?.join(', ')}
                        </Text>
                      </View>
                    )}

                    {/* Display Dietary Info */}
                    {(offer.nutritionalInfo.dietaryInfo?.length ?? 0) > 0 && (
                      <View
                        style={[
                          styles.nutritionSection,
                          (offer.nutritionalInfo.allergens?.length ?? 0) > 0 &&
                            styles.nutritionSectionSpaced,
                        ]}
                      >
                        <Text weight='semibold' size='sm' style={styles.nutritionHeading}>
                          {t('offers.dietaryInfo')}
                        </Text>
                        <View style={styles.dietaryTags}>
                          {offer.nutritionalInfo.dietaryInfo?.map((item, index) => (
                            <View key={index} style={styles.dietaryTag}>
                              <Text size='xs' weight='medium' style={styles.dietaryTagText}>
                                {item.charAt(0).toUpperCase() + item.slice(1)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

          <View style={styles.footerSpacer} />
        </View>
      </ScrollView>

      {/* --- Sticky Footer --- */}
      <View style={[styles.footer, footerStyle, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.footerInfo}>
          <Text size='xs' color='secondary'>
            {t('common.remaining')}
          </Text>
          <Text weight='bold' color={(offer.availableQuantity ?? 0) < 3 ? 'error' : 'primary'}>
            {t('offers.bagsLeft', { count: offer.availableQuantity ?? 0 })}
          </Text>
        </View>
        <Pressable
          accessibilityRole='button'
          style={[styles.reserveButton, reserveButtonStyle]}
          onPress={() => canReserve && setSheetVisible(true)}
          disabled={!canReserve}
        >
          <Text weight='bold' style={styles.reserveButtonText}>
            {canReserve
              ? t('offers.reserve')
              : isNotStarted && startTimeText != null
                ? t('offers.opensAt', { time: startTimeText })
                : t('offers.soldOut')}
          </Text>
        </Pressable>
      </View>

      {/* Bottom Sheet Overlay - renders within screen, not as Modal */}
      <ReserveBottomSheet
        visible={isSheetVisible}
        onClose={() => setSheetVisible(false)}
        onConfirm={handleConfirmReservation}
        offer={offer}
        theme={theme}
      />
    </View>
  );
};
