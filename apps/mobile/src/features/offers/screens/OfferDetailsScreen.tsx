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
import React, { useState, useEffect, useRef } from 'react';
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

// Your existing imports
import { Text, Button } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useFavoriteToggle } from '@/features/favorites/hooks';
import { useSelector } from 'react-redux';
import { selectIsFavorite } from '@/store/slices/favoritesSlice';
import type { RootState } from '@/store';

import { useOffer } from '../hooks/useOffers';
import { isOfferActive } from '../types/offer.types';
import { SkeletonOfferDetails } from '../components/SkeletonOfferDetails';
import { analytics } from '@/utils/analytics';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

// ─────────────────────────────────────────────────────────────────────────
// Animated Bottom Sheet Sub-Component (Custom Overlay - Best Practice)
// ─────────────────────────────────────────────────────────────────────────
const ReserveBottomSheet = ({ visible, onClose, onConfirm, offer, theme }: any) => {
  const [quantity, setQuantity] = useState(1);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
  }, [visible]);

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
  const establishmentName =
    typeof offer.establishmentId === 'object' && offer.establishmentId?.name
      ? offer.establishmentId.name
      : 'Establishment';

  // Get pickup time slot
  const pickupSlot = offer.pickupTimeSlots?.[0];
  const pickupTime = pickupSlot
    ? `${pickupSlot.startTime} - ${pickupSlot.endTime}`
    : 'Time not specified';

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
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.primary }]}>
            <Text weight='bold' style={{ color: '#fff', fontSize: 18 }}>
              {establishmentName}
            </Text>
            <Text size='sm' style={{ color: '#e5e7eb', marginTop: 4 }}>
              {offer.type ? offer.type.replace('_', ' ') : 'Surprise Bag'}
            </Text>
            <View style={styles.modalTimeRow}>
              <Clock color='#fff' size={16} />
              <Text size='sm' style={{ color: '#fff', marginLeft: 6 }}>
                Pickup Time: {pickupTime}
              </Text>
            </View>
          </View>

          <View style={styles.modalBody}>
            <Text align='center' color='secondary' size='sm' style={{ marginBottom: 16 }}>
              Select quantity
            </Text>

            {/* Quantity controls */}
            <View style={styles.quantityControls}>
              <Pressable
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                style={[styles.qtyButton, { backgroundColor: theme.colors.primary }]}
              >
                <Minus color='#fff' size={20} />
              </Pressable>
              <Text weight='bold' size='xl'>
                {quantity}
              </Text>
              <Pressable
                onPress={() => setQuantity(q => Math.min(offer.availableQuantity, q + 1))}
                style={[styles.qtyButton, { backgroundColor: theme.colors.primary }]}
              >
                <Plus color='#fff' size={20} />
              </Pressable>
            </View>

            {/* Terms & Conditions */}
            <View style={styles.termsContainer}>
              <Text size='xs' color='secondary' align='center' style={{ lineHeight: 18 }}>
                By reserving this meal you agree to Too Fresh To Waste's{' '}
                <Text
                  size='xs'
                  weight='semibold'
                  style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
                  onPress={() => {
                    // TODO: Navigate to Terms & Conditions screen
                    console.log('Navigate to Terms & Conditions');
                  }}
                >
                  terms & conditions
                </Text>
              </Text>
            </View>

            <View style={styles.modalDivider} />

            {/* Total */}
            <View style={styles.totalRow}>
              <Text size='md'>Total</Text>
              <Text weight='bold' size='lg'>
                {total} {offer.pricing.currency}
              </Text>
            </View>

            {/* Reserve button */}
            <Button
              variant='primary'
              size='lg'
              style={{ marginTop: 24 }}
              onPress={() => onConfirm(quantity)}
            >
              RESERVE NOW
            </Button>

            {/* Payment methods - Below button */}
            <View style={styles.paymentMethodsContainer}>
              <Text size='xs' color='secondary' align='center' style={{ marginBottom: 8 }}>
                Available Soon
              </Text>
              <View style={styles.paymentLogos}>
                <Image
                  source={require('@/assets/images/PayMe.png')}
                  style={styles.paymentLogo}
                  resizeMode='contain'
                />
                <Image
                  source={require('@/assets/images/ClickToPay.png')}
                  style={styles.paymentLogo}
                  resizeMode='contain'
                />
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
    if (offer) {
      analytics.trackOfferViewed(
        offerId,
        offer.title,
        offer.pricing?.discountedPrice,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.id ?? (offer as any)?._id]);

  if (isLoading) {
    return <SkeletonOfferDetails />;
  }

  if (error || !offer) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text weight='bold' color='error'>
          ⚠️ Error Loading Offer
        </Text>
        <Button variant='primary' style={{ marginTop: 20 }} onPress={() => refetch()}>
          Retry
        </Button>
      </View>
    );
  }

  const canReserve = isOfferActive(offer) && (offer.availableQuantity ?? 0) > 0;

  const handleConfirmReservation = (qty: number) => {
    setSheetVisible(false);
    // ✅ BUGFIX: Backend aggregation returns _id, frontend expects id
    const offerId = (offer as any)._id || offer.id;
    navigation.navigate('Checkout', { offerId, quantity: qty });
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
      console.error('Error opening maps:', error);
      Alert.alert('Error', 'Failed to open maps. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle='light-content' translucent backgroundColor='transparent' />

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
              <ChevronLeft color='#111827' size={24} />
            </Pressable>
            <View style={styles.topRightActions}>
              <Pressable
                style={styles.iconButton}
                onPress={toggleFavorite}
                disabled={isFavoriteLoading}
                accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                accessibilityRole='button'
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
          {offer.establishmentId && (
            <View style={styles.merchantLogoContainer}>
              {typeof offer.merchantId === 'object' &&
              offer.merchantId?.profileImage !== null &&
              offer.merchantId?.profileImage !== undefined &&
              offer.merchantId.profileImage.length > 0 ? (
                <Image
                  source={{ uri: offer.merchantId.profileImage }}
                  style={styles.merchantLogo}
                  resizeMode='cover'
                />
              ) : (
                <View style={styles.merchantLogoPlaceholder}>
                  <Text weight='bold' style={{ color: '#fff', fontSize: 16 }}>
                    {typeof offer.establishmentId === 'object' && offer.establishmentId?.name
                      ? offer.establishmentId.name.charAt(0).toUpperCase()
                      : 'E'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.headerTextContainer}>
            <Text weight='bold' style={{ color: '#fff' }} size='xl'>
              {typeof offer.establishmentId === 'object' && offer.establishmentId?.name
                ? offer.establishmentId.name
                : 'Establishment'}
            </Text>
            <Text style={{ color: '#e5e7eb' }}>{offer.categories?.join(' • ')}</Text>
          </View>
        </View>

        {/* --- Info Section --- */}
        <View style={styles.contentContainer}>
          <View style={styles.itemHeader}>
            <View style={styles.itemTitleRow}>
              <ShoppingBag color={theme.colors.secondary} size={20} />
              <Text weight='semibold' size='md' style={{ marginLeft: 12 }}>
                {offer.type ? offer.type.replace('_', ' ') : 'Surprise Bag'}
              </Text>
            </View>
            <View style={styles.priceContainer}>
              <Text size='md' color='secondary' style={styles.oldPrice}>
                {offer.pricing.originalPrice.toFixed(2)} {offer.pricing.currency}
              </Text>
              <Text weight='bold' size='lg' style={{ color: theme.colors.primary }}>
                {offer.pricing.discountedPrice.toFixed(2)} {offer.pricing.currency}
              </Text>
            </View>
          </View>

          {/* --- Rating Section --- */}
          {typeof offer.establishmentId === 'object' &&
            offer.establishmentId?.averageRating != null &&
            offer.establishmentId.averageRating > 0 && (
              <View style={styles.ratingRow}>
                <Star color='#facc15' fill='#facc15' size={16} />
                <Text weight='semibold' size='md' style={styles.ratingText}>
                  {offer.establishmentId.averageRating.toFixed(1)}
                </Text>
                {offer.establishmentId?.totalReviews != null &&
                  offer.establishmentId.totalReviews > 0 && (
                    <Text size='md' color='secondary' style={styles.reviewCount}>
                      ({offer.establishmentId.totalReviews})
                    </Text>
                  )}
              </View>
            )}

          <View style={styles.pickupRow}>
            <Clock color='#9ca3af' size={20} />
            <Text style={styles.pickupText}>
              Pick up: {offer.pickupTimeSlots?.[0]?.startTime} -{' '}
              {offer.pickupTimeSlots?.[0]?.endTime}
            </Text>
            <View style={[styles.todayBadge, { backgroundColor: theme.colors.success }]}>
              <Text weight='bold' style={{ color: '#fff', fontSize: 10 }}>
                TODAY
              </Text>
            </View>
          </View>

          {offer.pickupTimeSlots?.[0]?.maxOrders != null && (
            <View style={styles.slotLimitRow}>
              <Users color='#9ca3af' size={16} />
              <Text style={styles.slotLimitText}>
                This restaurant allows up to {offer.pickupTimeSlots[0].maxOrders} bag{offer.pickupTimeSlots[0].maxOrders === 1 ? '' : 's'} per offer
              </Text>
            </View>
          )}

          {/* --- Location Card --- */}
          {typeof offer.establishmentId === 'object' && offer.establishmentId?.address && (
            <Pressable
              style={styles.locationCard}
              onPress={handleOpenMaps}
            >
              <View style={styles.locationContent}>
                <View style={styles.locationIconContainer}>
                  <MapPin color='#fff' size={16} strokeWidth={2} />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text weight='semibold' style={styles.locationAddress} numberOfLines={1}>
                    {offer.establishmentId.address.street}, {offer.establishmentId.address.city}
                  </Text>
                  <Text size='sm' color='secondary' style={styles.locationSubtext}>
                    Tap to view location on map
                  </Text>
                </View>
              </View>
              <ChevronRight color='#9ca3af' size={20} strokeWidth={1.5} />
            </Pressable>
          )}

          <View style={styles.divider} />

          {/* --- Description Accordion --- */}
          <View style={styles.section}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setIsDescriptionOpen(!isDescriptionOpen)}
            >
              <Text weight='semibold' size='md'>
                What you could get
              </Text>
              {isDescriptionOpen ? (
                <ChevronUp color='#9ca3af' size={20} />
              ) : (
                <ChevronDown color='#9ca3af' size={20} />
              )}
            </Pressable>
            {isDescriptionOpen && (
              <View style={styles.accordionContent}>
                <Text color='secondary' style={{ lineHeight: 22 }}>
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
                  <Text weight='semibold' size='md'>
                    Ingredients & Allergens
                  </Text>
                  {isAllergensOpen ? (
                    <ChevronUp color='#9ca3af' size={20} />
                  ) : (
                    <ChevronDown color='#9ca3af' size={20} />
                  )}
                </Pressable>
                {isAllergensOpen && (
                  <View style={styles.accordionContent}>
                    {/* Display Allergens */}
                    {(offer.nutritionalInfo.allergens?.length ?? 0) > 0 && (
                      <View style={styles.nutritionSection}>
                        <Text weight='semibold' size='sm' style={{ color: '#111827' }}>
                          Allergens
                        </Text>
                        <Text color='secondary' style={{ lineHeight: 20, marginTop: 4 }}>
                          {offer.nutritionalInfo.allergens?.join(', ')}
                        </Text>
                      </View>
                    )}

                    {/* Display Dietary Info */}
                    {(offer.nutritionalInfo.dietaryInfo?.length ?? 0) > 0 && (
                      <View
                        style={[
                          styles.nutritionSection,
                          (offer.nutritionalInfo.allergens?.length ?? 0) > 0 && { marginTop: 16 },
                        ]}
                      >
                        <Text weight='semibold' size='sm' style={{ color: '#111827' }}>
                          Dietary Information
                        </Text>
                        <View style={styles.dietaryTags}>
                          {offer.nutritionalInfo.dietaryInfo?.map((item, index) => (
                            <View key={index} style={styles.dietaryTag}>
                              <Text size='xs' weight='medium' style={{ color: '#0f766e' }}>
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

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* --- Sticky Footer --- */}
      <View style={[styles.footer, { borderTopColor: theme.colors.outline }]}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text size='xs' color='secondary'>
            Remaining
          </Text>
          <Text weight='bold' color={(offer.availableQuantity ?? 0) < 3 ? 'error' : 'primary'}>
            {offer.availableQuantity ?? 0} bags left
          </Text>
        </View>
        <Pressable
          style={[
            styles.reserveButton,
            { backgroundColor: theme.colors.primary, opacity: canReserve ? 1 : 0.6 },
          ]}
          onPress={() => canReserve && setSheetVisible(true)}
          disabled={!canReserve}
        >
          <Text weight='bold' style={{ color: '#fff' }}>
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
    backgroundColor: 'rgba(255,255,255,0.9)',
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
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  merchantLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTextContainer: { position: 'absolute', bottom: 20, left: 90, right: 20 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 24 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { textDecorationLine: 'line-through' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  ratingText: { color: '#111827' },
  reviewCount: { color: '#9ca3af' },
  pickupRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  pickupText: { fontSize: 15, color: '#4b5563', marginLeft: 8, marginRight: 8 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  slotLimitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  slotLimitText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  locationCard: {
    marginTop: 24,
    backgroundColor: '#eafaf8',
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
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  locationTextContainer: { flex: 1, justifyContent: 'center' },
  locationAddress: {
    color: '#0f766e',
    fontSize: 15,
    lineHeight: 20,
  },
  locationSubtext: { marginTop: 2, fontWeight: '300' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 24 },
  section: { marginVertical: 8 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionContent: { marginTop: 12 },
  nutritionSection: { marginBottom: 0 },
  dietaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  dietaryTag: {
    backgroundColor: '#eafaf8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  reserveButton: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },

  // ✅ BEST PRACTICE: Custom overlay (not Modal) - naturally respects navigation boundaries
  // Renders within screen container, backdrop starts from screen content (below header)
  modalOverlay: {
    ...StyleSheet.absoluteFillObject, // Covers entire screen content
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject, // Covers entire screen content area
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.85, // 85% of screen height
    shadowColor: '#000',
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
  modalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  modalBody: { padding: 24, paddingTop: 16 },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  termsContainer: {
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  paymentMethodsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
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
  modalDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
