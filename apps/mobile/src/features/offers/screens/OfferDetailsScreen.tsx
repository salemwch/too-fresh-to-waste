import {
  ChevronLeft,
  Heart,
  ShoppingBag,
  Clock,
  ChevronUp,
  ChevronDown,
  Minus,
  Plus,
  Star,
  MapPin,
  ChevronRight,
  Users,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Pressable,
  StatusBar,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  Linking,
  Alert,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector } from 'react-redux';

import ClickToPayImage from '@/assets/images/ClickToPay.png';
import PayMeImage from '@/assets/images/PayMe.png';
import { Text, Button } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useFavoriteToggle } from '@/features/favorites/hooks';
import { selectIsFavorite } from '@/store/slices/favoritesSlice';
import { analytics } from '@/utils/analytics';
import { Logger } from '@/utils/logger';

import { SkeletonOfferDetails } from '../components/SkeletonOfferDetails';
import { useOffer } from '../hooks/useOffers';
import { isOfferActive } from '../types/offer.types';

import type { Offer } from '../types/offer.types';
import type { MainStackParamList } from '@/navigation/types';
import type { RootState } from '@/store';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SURFACE = '#fff';
const SURFACE_MUTED = '#e5e7eb';
const SURFACE_SUBTLE = '#f3f4f6';
const SURFACE_SOFT = '#eafaf8';
const SURFACE_OVERLAY = 'rgba(255,255,255,0.9)';
const BACKDROP = 'rgba(0,0,0,0.6)';
const SHADOW = '#000';
const TEXT_PRIMARY = '#111827';
const TEXT_MUTED = '#4b5563';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const WHITE = '#fff';
const INDIGO = '#6366f1';
const TEAL = '#0f766e';
const SUCCESS_BORDER = '#a7f3d0';

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

  const discountedPrice = offer.pricing.discountedPrice;
  const total = (discountedPrice * quantity).toFixed(2);

  // Get establishment name
  const establishmentName = establishment?.name ?? 'Establishment';

  // Get pickup time slot
  const pickupSlot = offer.pickupTimeSlots?.[0];
  const pickupTime = pickupSlot
    ? `${pickupSlot.startTime} - ${pickupSlot.endTime}`
    : 'Time not specified';
  const handleTermsPress = () => {
    Alert.alert('Terms & Conditions', 'Terms & conditions will be available soon.');
  };

  return (
    <View style={styles.modalOverlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop - covers screen content, not navigation header */}
      <TouchableWithoutFeedback onPress={handleClose}>
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
          <Text weight="bold" style={styles.modalHeaderTitle}>
            {establishmentName}
          </Text>
          <Text size="sm" style={styles.modalHeaderSubtitle}>
            {offer.type.replace('_', ' ')}
          </Text>
          <View style={styles.modalTimeRow}>
            <Clock color={WHITE} size={16} />
            <Text size="sm" style={styles.modalTimeText}>
              Pickup Time: {pickupTime}
            </Text>
          </View>
        </View>

        <View style={styles.modalBody}>
          <Text align="center" color="secondary" size="sm" style={styles.quantityLabel}>
            Select quantity
          </Text>

          {/* Quantity controls */}
          <View style={styles.quantityControls}>
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              style={[styles.qtyButton, qtyButtonStyle]}
            >
              <Minus color={WHITE} size={20} />
            </Pressable>
            <Text weight="bold" size="xl">
              {quantity}
            </Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(offer.availableQuantity ?? 1, q + 1))}
              style={[styles.qtyButton, qtyButtonStyle]}
            >
              <Plus color={WHITE} size={20} />
            </Pressable>
          </View>

          {/* Terms & Conditions */}
          <View style={styles.termsContainer}>
            <Text size="xs" color="secondary" align="center" style={styles.termsText}>
              By reserving this meal you agree to Too Fresh To Waste’s{' '}
              <Text
                size="xs"
                weight="semibold"
                style={[styles.termsLink, termsLinkColorStyle]}
                onPress={handleTermsPress}
              >
                terms & conditions
              </Text>
            </Text>
          </View>

          <View style={styles.modalDivider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text size="md">Total</Text>
            <Text weight="bold" size="lg">
              {total} {offer.pricing.currency}
            </Text>
          </View>

          {/* Reserve button */}
          <Button
            variant="primary"
            size="lg"
            style={styles.reserveButtonSpacing}
            onPress={() => onConfirm(quantity)}
          >
            RESERVE NOW
          </Button>

          {/* Payment methods - Below button */}
          <View style={styles.paymentMethodsContainer}>
            <Text size="xs" color="secondary" align="center" style={styles.paymentSoonLabel}>
              Available Soon
            </Text>
            <View style={styles.paymentLogos}>
              <Image source={PayMeImage} style={styles.paymentLogo} resizeMode="contain" />
              <Image source={ClickToPayImage} style={styles.paymentLogo} resizeMode="contain" />
            </View>
          </View>
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
  const { offerId } = route.params;
  const { data: offer, isLoading, error, refetch } = useOffer(offerId);
  const establishment =
    typeof offer?.establishmentId === 'object' && offer.establishmentId !== null
      ? offer.establishmentId
      : undefined;
  const merchant =
    typeof offer?.merchantId === 'object' && offer.merchantId !== null
      ? offer.merchantId
      : undefined;

  // ✅ Favorite toggle hook
  const { toggle: toggleFavorite, isLoading: isFavoriteLoading } = useFavoriteToggle(
    offerId,
    offer?.title,
    offer?.images?.[0],
  );
  const isFavorite = useSelector((state: RootState) => selectIsFavorite(state, offerId));

  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [isAllergensOpen, setIsAllergensOpen] = useState(false);
  const [isSheetVisible, setSheetVisible] = useState(false);

  // Fire once when offer data arrives
  useEffect(() => {
    if (offer !== undefined) {
      analytics.trackOfferViewed(offerId, offer.title, offer.pricing.discountedPrice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?._id, offer?.id, offerId]);

  if (isLoading) {
    return <SkeletonOfferDetails />;
  }

  if (error !== null || offer === undefined) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text weight="bold" color="error">
          ⚠️ Error Loading Offer
        </Text>
        <Button variant="primary" style={styles.retryButton} onPress={() => void refetch()}>
          Retry
        </Button>
      </View>
    );
  }

  const canReserve = isOfferActive(offer) && (offer.availableQuantity ?? 0) > 0;
  const todayBadgeStyle = { backgroundColor: theme.colors.success };
  const footerStyle = { borderTopColor: theme.colors.outline };
  const reserveButtonStyle = {
    backgroundColor: theme.colors.primary,
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
        Alert.alert(
          'Location Unavailable',
          'Location information is not available for this establishment.',
        );
        return;
      }

      const { address } = offer.establishmentId;

      // Verify coordinates exist and are valid
      if (address.coordinates?.coordinates?.length !== 2) {
        Alert.alert('Location Unavailable', 'Location coordinates are not available.');
        return;
      }

      // GeoJSON format: [longitude, latitude]
      const [longitude, latitude] = address.coordinates.coordinates;

      // Validate coordinates
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        Alert.alert('Location Error', 'Invalid location coordinates.');
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
        Alert.alert('Error', 'Unable to open maps. Please check your device settings.');
      }
    } catch (error) {
      Logger.error('Error opening maps', {}, error instanceof Error ? error : undefined);
      Alert.alert('Error', 'Failed to open maps. Please try again.');
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* --- Header Section --- */}
        <View style={styles.headerContainer}>
          <Image source={{ uri: offer.images?.[0] }} style={styles.headerImage} />
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradientOverlay}
          />

          <View style={styles.topNav}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <ChevronLeft color="#111827" size={24} />
            </Pressable>
            <View style={styles.topRightActions}>
              <Pressable
                style={styles.iconButton}
                onPress={handleFavoritePress}
                disabled={isFavoriteLoading}
                accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                accessibilityRole="button"
              >
                <Heart
                  color={isFavorite ? '#005250' : '#111827'}
                  size={20}
                  fill={isFavorite ? '#005250' : 'transparent'}
                  strokeWidth={isFavorite ? 0 : 2}
                />
              </Pressable>
            </View>
          </View>

          {/* Merchant Logo - Bottom Left */}
          {(offer.establishmentId !== '' || establishment !== undefined) && (
            <View style={styles.merchantLogoContainer}>
              {merchant?.profileImage != null && merchant.profileImage.length > 0 ? (
                <Image
                  source={{ uri: merchant.profileImage }}
                  style={styles.merchantLogo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.merchantLogoPlaceholder}>
                  <Text weight="bold" style={styles.logoPlaceholderText}>
                    {establishment?.name !== undefined
                      ? establishment.name.charAt(0).toUpperCase()
                      : 'E'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.headerTextContainer}>
            <Text weight="bold" style={styles.headerTitleText} size="xl">
              {establishment?.name ?? 'Establishment'}
            </Text>
            <Text style={styles.headerSubtitleText}>{offer.categories?.join(' • ')}</Text>
          </View>
        </View>

        {/* --- Info Section --- */}
        <View style={styles.contentContainer}>
          <View style={styles.itemHeader}>
            <View style={styles.itemTitleRow}>
              <ShoppingBag color={theme.colors.secondary} size={20} />
              <Text weight="semibold" size="md" style={styles.offerTypeText}>
                {offer.type.replace('_', ' ')}
              </Text>
            </View>
            <View style={styles.priceContainer}>
              <Text size="md" color="secondary" style={styles.oldPrice}>
                {offer.pricing.originalPrice.toFixed(2)} {offer.pricing.currency}
              </Text>
              <Text weight="bold" size="lg" style={{ color: theme.colors.primary }}>
                {offer.pricing.discountedPrice.toFixed(2)} {offer.pricing.currency}
              </Text>
            </View>
          </View>

          {/* --- Rating Section --- */}
          {establishment?.averageRating != null && establishment.averageRating > 0 && (
            <View style={styles.ratingRow}>
              <Star color="#facc15" fill="#facc15" size={16} />
              <Text weight="semibold" size="md" style={styles.ratingText}>
                {establishment.averageRating.toFixed(1)}
              </Text>
              {establishment.totalReviews != null && establishment.totalReviews > 0 && (
                <Text size="md" color="secondary" style={styles.reviewCount}>
                  ({establishment.totalReviews})
                </Text>
              )}
            </View>
          )}

          <View style={styles.pickupRow}>
            <Clock color="#9ca3af" size={20} />
            <Text style={styles.pickupText}>
              Pick up: {offer.pickupTimeSlots?.[0]?.startTime} -{' '}
              {offer.pickupTimeSlots?.[0]?.endTime}
            </Text>
            <View style={[styles.todayBadge, todayBadgeStyle]}>
              <Text weight="bold" style={styles.todayBadgeText}>
                TODAY
              </Text>
            </View>
          </View>

          {offer.pickupTimeSlots?.[0]?.maxOrders != null && (
            <View style={styles.slotLimitRow}>
              <Users color="#9ca3af" size={16} />
              <Text style={styles.slotLimitText}>
                This restaurant allows up to {offer.pickupTimeSlots[0].maxOrders} bag
                {offer.pickupTimeSlots[0].maxOrders === 1 ? '' : 's'} per offer
              </Text>
            </View>
          )}

          {/* --- Location Card --- */}
          {establishment?.address !== undefined && (
            <Pressable style={styles.locationCard} onPress={handleOpenMapsPress}>
              <View style={styles.locationContent}>
                <View style={styles.locationIconContainer}>
                  <MapPin color={WHITE} size={16} strokeWidth={2} />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text weight="semibold" style={styles.locationAddress} numberOfLines={1}>
                    {establishment.address.street}, {establishment.address.city}
                  </Text>
                  <Text size="sm" color="secondary" style={styles.locationSubtext}>
                    Tap to view location on map
                  </Text>
                </View>
              </View>
              <ChevronRight color="#9ca3af" size={20} strokeWidth={1.5} />
            </Pressable>
          )}

          <View style={styles.divider} />

          {/* --- Description Accordion --- */}
          <View style={styles.section}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setIsDescriptionOpen(!isDescriptionOpen)}
            >
              <Text weight="semibold" size="md">
                What you could get
              </Text>
              {isDescriptionOpen ? (
                <ChevronUp color="#9ca3af" size={20} />
              ) : (
                <ChevronDown color="#9ca3af" size={20} />
              )}
            </Pressable>
            {isDescriptionOpen && (
              <View style={styles.accordionContent}>
                <Text color="secondary" style={styles.descriptionText}>
                  {offer.description}
                </Text>
              </View>
            )}
          </View>

          {/* --- Allergens & Dietary Accordion --- */}
          {offer.nutritionalInfo &&
            ((offer.nutritionalInfo.allergens?.length ?? 0) > 0 ||
              (offer.nutritionalInfo.dietaryInfo?.length ?? 0) > 0) && (
              <View style={styles.section}>
                <Pressable
                  style={styles.accordionHeader}
                  onPress={() => setIsAllergensOpen(!isAllergensOpen)}
                >
                  <Text weight="semibold" size="md">
                    Ingredients & Allergens
                  </Text>
                  {isAllergensOpen ? (
                    <ChevronUp color="#9ca3af" size={20} />
                  ) : (
                    <ChevronDown color="#9ca3af" size={20} />
                  )}
                </Pressable>
                {isAllergensOpen && (
                  <View style={styles.accordionContent}>
                    {/* Display Allergens */}
                    {(offer.nutritionalInfo.allergens?.length ?? 0) > 0 && (
                      <View style={styles.nutritionSection}>
                        <Text weight="semibold" size="sm" style={styles.nutritionHeading}>
                          Allergens
                        </Text>
                        <Text color="secondary" style={styles.nutritionBody}>
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
                        <Text weight="semibold" size="sm" style={styles.nutritionHeading}>
                          Dietary Information
                        </Text>
                        <View style={styles.dietaryTags}>
                          {offer.nutritionalInfo.dietaryInfo?.map((item, index) => (
                            <View key={index} style={styles.dietaryTag}>
                              <Text size="xs" weight="medium" style={styles.dietaryTagText}>
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
      <View style={[styles.footer, footerStyle]}>
        <View style={styles.footerInfo}>
          <Text size="xs" color="secondary">
            Remaining
          </Text>
          <Text weight="bold" color={(offer.availableQuantity ?? 0) < 3 ? 'error' : 'primary'}>
            {offer.availableQuantity ?? 0} bags left
          </Text>
        </View>
        <Pressable
          style={[styles.reserveButton, reserveButtonStyle]}
          onPress={() => canReserve && setSheetVisible(true)}
          disabled={!canReserve}
        >
          <Text weight="bold" style={styles.reserveButtonText}>
            {canReserve ? 'Reserve' : 'Sold Out'}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  retryButton: { marginTop: 20 },
  scrollContent: { paddingBottom: 0 },
  headerContainer: { height: 280, width: '100%', position: 'relative' },
  headerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  topNav: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightActions: { flexDirection: 'row' },
  merchantLogoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 5,
  },
  merchantLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE,
    borderWidth: 3,
    borderColor: SURFACE,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  merchantLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: INDIGO,
    borderWidth: 3,
    borderColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  logoPlaceholderText: { color: WHITE, fontSize: 16 },
  headerTextContainer: { position: 'absolute', bottom: 20, left: 90, right: 20 },
  headerTitleText: { color: WHITE },
  headerSubtitleText: { color: SURFACE_MUTED },
  contentContainer: { paddingHorizontal: 20, paddingTop: 24 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center' },
  offerTypeText: { marginLeft: 12 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { textDecorationLine: 'line-through' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  ratingText: { color: TEXT_PRIMARY },
  reviewCount: { color: TEXT_TERTIARY },
  pickupRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  pickupText: { fontSize: 15, color: TEXT_MUTED, marginLeft: 8, marginRight: 8 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  todayBadgeText: { color: WHITE, fontSize: 10 },
  slotLimitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  slotLimitText: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '500' },
  locationCard: {
    marginTop: 24,
    backgroundColor: SURFACE_SOFT,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationContent: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 16 },
  locationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  locationTextContainer: { flex: 1, justifyContent: 'center' },
  locationAddress: {
    color: TEAL,
    fontSize: 15,
    lineHeight: 20,
  },
  locationSubtext: { marginTop: 2, fontWeight: '300' },
  divider: { height: 1, backgroundColor: SURFACE_SUBTLE, marginVertical: 24 },
  section: { marginVertical: 8 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionContent: { marginTop: 12 },
  nutritionSection: { marginBottom: 0 },
  descriptionText: { lineHeight: 22 },
  nutritionHeading: { color: TEXT_PRIMARY },
  nutritionBody: { lineHeight: 20, marginTop: 4 },
  nutritionSectionSpaced: { marginTop: 16 },
  dietaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  dietaryTag: {
    backgroundColor: SURFACE_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
  },
  dietaryTagText: { color: TEAL },
  footerSpacer: { height: 120 },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: SURFACE,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  footerInfo: { flex: 1, marginRight: 16 },
  reserveButton: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  reserveButtonText: { color: WHITE },

  // ✅ BEST PRACTICE: Custom overlay (not Modal) - naturally respects navigation boundaries
  // Renders within screen container, backdrop starts from screen content (below header)
  modalOverlay: {
    ...StyleSheet.absoluteFillObject, // Covers entire screen content
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject, // Covers entire screen content area
    backgroundColor: BACKDROP,
  },
  modalContent: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.85, // 85% of screen height
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    padding: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  modalHeaderTitle: { color: WHITE, fontSize: 18 },
  modalHeaderSubtitle: { color: SURFACE_MUTED, marginTop: 4 },
  modalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  modalTimeText: { color: WHITE, marginLeft: 6 },
  modalBody: { padding: 24, paddingTop: 16 },
  quantityLabel: { marginBottom: 16 },
  quantityControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    marginVertical: 10,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  reserveButtonSpacing: { marginTop: 24 },
  termsContainer: {
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  termsText: { lineHeight: 18 },
  termsLink: { textDecorationLine: 'underline' },
  paymentMethodsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  paymentSoonLabel: { marginBottom: 8 },
  paymentLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  paymentLogo: {
    width: 60,
    height: 28,
  },
  modalDivider: { height: 1, backgroundColor: SURFACE_MUTED, marginVertical: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
