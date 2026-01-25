import {
  ChevronLeft,
  Share2,
  Heart,
  ShoppingBag,
  Star,
  Clock,
  MapPin,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Minus,
  Plus,
  Info,
} from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// Your existing imports
import { Text, Button } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { formatTime } from '@/utils/datetime';

import { useOffer } from '../hooks/useOffers';
import { getOfferStatusLabel, isOfferActive } from '../types/offer.types';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
// Animated Bottom Sheet Sub-Component
// ─────────────────────────────────────────────────────────────────────────
const ReserveBottomSheet = ({ visible, onClose, onConfirm, offer, theme }: any) => {
  const [quantity, setQuantity] = useState(1);
  const [showModal, setShowModal] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Boolean(visible)) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.out(Easing.poly(4)),
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setShowModal(false);
      onClose();
    });
  };

  if (!Boolean(showModal)) return null;

  const discountedPrice = offer.pricing.discountedPrice;
  const total = (discountedPrice * quantity).toFixed(2);

  return (
    <Modal transparent visible={showModal} animationType='none' onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.primary }]}>
            <Text weight='bold' style={{ color: '#fff' }} size='md'>
              {offer.title}
            </Text>
            <View style={styles.modalTimeRow}>
              <Clock color='#fff' size={14} />
              <Text size='sm' style={{ color: '#fff' }}>
                Pickup slots available
              </Text>
            </View>
          </View>

          <View style={styles.modalBody}>
            <Text align='center' color='secondary' size='sm' style={{ marginBottom: 16 }}>
              Select quantity
            </Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                style={[styles.qtyButton, { backgroundColor: theme.colors.primary }]}
              >
                <Minus color='#fff' size={20} />
              </TouchableOpacity>
              <Text weight='bold' size='xl'>
                {quantity}
              </Text>
              <TouchableOpacity
                onPress={() => setQuantity(q => Math.min(offer.availableQuantity, q + 1))}
                style={[styles.qtyButton, { backgroundColor: theme.colors.primary }]}
              >
                <Plus color='#fff' size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalDivider} />
            <View style={styles.totalRow}>
              <Text size='md'>Total</Text>
              <Text weight='bold' size='lg'>
                {total} {offer.pricing.currency}
              </Text>
            </View>

            <Button
              variant='primary'
              size='lg'
              style={{ marginTop: 24 }}
              onPress={() => onConfirm(quantity)}
            >
              RESERVE NOW
            </Button>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────
export const OfferDetailsScreen: React.FC<OfferDetailsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { offerId } = route.params;
  const { data: offer, isLoading, error, refetch } = useOffer(offerId);

  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [isSheetVisible, setSheetVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size='large' color={theme.colors.primary} />
      </View>
    );
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
    navigation.navigate('Checkout', { offerId: offer.id, quantity: qty });
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
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
              <ChevronLeft color='#111827' size={24} />
            </TouchableOpacity>
            <View style={styles.topRightActions}>
              <TouchableOpacity style={styles.iconButton}>
                <Share2 color='#111827' size={20} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, { marginLeft: 12 }]}>
                <Heart color='#111827' size={20} />
              </TouchableOpacity>
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
              <Text weight='semibold' size='md' style={{ marginLeft: 8 }}>
                {offer.type ? offer.type.replace('_', ' ') : 'Surprise Bag'}
              </Text>
            </View>
            <View style={styles.priceContainer}>
              <Text size='sm' color='secondary' style={styles.oldPrice}>
                {offer.pricing.originalPrice.toFixed(2)} {offer.pricing.currency}
              </Text>
              <Text weight='bold' size='lg' style={{ color: theme.colors.primary }}>
                {offer.pricing.discountedPrice.toFixed(2)} {offer.pricing.currency}
              </Text>
            </View>
          </View>

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

          <View style={styles.divider} />

          {/* --- Description Accordion --- */}
          <View style={styles.section}>
            <TouchableOpacity
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
            </TouchableOpacity>
            {isDescriptionOpen && (
              <View style={styles.accordionContent}>
                <Text color='secondary' style={{ lineHeight: 22 }}>
                  {offer.description}
                </Text>
              </View>
            )}
          </View>

          {/* --- Allergens & Dietary --- */}
          {offer.nutritionalInfo && (
            <View style={[styles.infoBox, { backgroundColor: '#f9fafb' }]}>
              <Info size={18} color={theme.colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text weight='semibold' size='sm'>
                  Ingredients & Allergens
                </Text>
                <Text size='xs' color='secondary'>
                  {offer.nutritionalInfo.allergens?.join(', ') != null || 'No allergens listed'}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* --- Sticky Footer --- */}
      <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text size='xs' color='secondary'>
            Remaining
          </Text>
          <Text weight='bold' color={offer.availableQuantity < 3 ? 'error' : 'primary'}>
            {offer.availableQuantity} bags left
          </Text>
        </View>
        <TouchableOpacity
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
        </TouchableOpacity>
      </View>

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
  priceContainer: { alignItems: 'flex-end' },
  oldPrice: { textDecorationLine: 'line-through', marginBottom: 2 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  pickupText: { fontSize: 15, color: '#4b5563', marginLeft: 8, marginRight: 8 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 24 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionContent: { marginTop: 12 },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
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

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: { padding: 24, alignItems: 'center' },
  modalTimeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  modalBody: { padding: 24 },
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
  },
  modalDivider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
