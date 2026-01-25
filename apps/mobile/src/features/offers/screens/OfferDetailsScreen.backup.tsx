/**
 * Offer Details Screen
 * Display full details of a specific food waste offer
 *
 * Features:
 * - Real-time data fetching with React Query
 * - Loading, error, and success states
 * - Image carousel for offer photos
 * - Pricing information with discount percentage
 * - Availability and pickup time slots
 * - Nutritional information and allergens
 * - Reserve/checkout functionality
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { formatTime } from '@/utils/datetime';

import { useOffer } from '../hooks/useOffers';
import { getOfferStatusLabel, getOfferTypeLabel, isOfferActive } from '../types/offer.types';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OfferDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OfferDetails'
>;

type OfferDetailsScreenRouteProp = RouteProp<MainStackParamList, 'OfferDetails'>;

interface OfferDetailsScreenProps {
  navigation: OfferDetailsScreenNavigationProp;
  route: OfferDetailsScreenRouteProp;
}

export const OfferDetailsScreen: React.FC<OfferDetailsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { offerId } = route.params;

  // Fetch offer data using React Query
  const { data: offer, isLoading, error, refetch } = useOffer(offerId);

  // ─────────────────────────────────────────────────────────────────────────
  // Loading State
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size='large' color={theme.colors.primary} />
        <Text variant='body' size='md' color='secondary' style={{ marginTop: 16 }} align='center'>
          Loading offer details...
        </Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Error State
  // ─────────────────────────────────────────────────────────────────────────

  if (error || !offer) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text variant='headline' size='lg' weight='bold' color='error' align='center'>
          ⚠️ Error Loading Offer
        </Text>
        <Text
          variant='body'
          size='md'
          color='secondary'
          align='center'
          style={{ marginTop: 12, marginBottom: 24 }}
        >
          {(error?.message ?? '').trim() !== ''
            ? error?.message
            : 'Failed to load offer details. Please try again.'}
        </Text>
        <Button
          variant='primary'
          size='md'
          onPress={() => {
            void refetch();
          }}
        >
          Retry
        </Button>
        <Button
          variant='ghost'
          size='md'
          onPress={() => navigation.goBack()}
          style={{ marginTop: 12 }}
        >
          Go Back
        </Button>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Functions
  // ─────────────────────────────────────────────────────────────────────────

  const handleReserve = () => {
    if (!isOfferActive(offer)) {
      Alert.alert('Offer Unavailable', 'This offer is currently not available for reservation.', [
        { text: 'OK' },
      ]);
      return;
    }

    // Navigate to checkout
    navigation.navigate('Checkout', { offerId: offer.id });
  };

  /**
   * Format date string for display WITH timezone conversion.
   * Backend stores UTC, automatically converts to user's local timezone (Tunisia UTC+1).
   *
   * Example: Backend "2026-01-11T18:50:00.000Z" (UTC) → Tunisia user sees "Jan 11, 2026, 19:50"
   */
  const formatDate = (dateString: string) => {
    try {
      // Use utility function that converts UTC to local timezone
      return formatTime(dateString, { showDate: true });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number, currency: string) => `${price.toFixed(2)} ${currency}`;

  // Defensive checks for required data
  if (!offer.pricing?.originalPrice || !offer.pricing.discountedPrice) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text variant='headline' size='lg' weight='bold' color='error' align='center'>
          ⚠️ Invalid Offer Data
        </Text>
        <Text
          variant='body'
          size='md'
          color='secondary'
          align='center'
          style={{ marginTop: 12, marginBottom: 24 }}
        >
          This offer is missing required pricing information.
        </Text>
        <Button variant='ghost' size='md' onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  const availableQty = offer.availableQuantity ?? 0;
  const canReserve = isOfferActive(offer) && availableQty > 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Render UI
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Images Carousel */}
        {Array.isArray(offer.images) && offer.images.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imagesCarousel}
          >
            {offer.images.map((imageUrl, index) => (
              <Image
                key={index}
                source={{ uri: imageUrl }}
                style={styles.offerImage}
                resizeMode='cover'
              />
            ))}
          </ScrollView>
        )}

        {/* Main Content Card */}
        <Card style={styles.card}>
          {/* Title & Type */}
          <View style={styles.header}>
            <Text variant='headline' size='xl' weight='bold' style={styles.title}>
              {offer.title}
            </Text>
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text variant='label' size='sm' weight='bold' style={{ color: '#fff' }}>
                {getOfferTypeLabel(offer.type)}
              </Text>
            </View>
          </View>

          {/* Status */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: canReserve
                  ? `${theme.colors.success}20`
                  : `${theme.colors.error}20`,
              },
            ]}
          >
            <Text
              variant='label'
              size='sm'
              weight='semibold'
              style={{ color: canReserve ? theme.colors.success : theme.colors.error }}
            >
              {getOfferStatusLabel(offer.status)}
              {!canReserve && ' - Not Available'}
            </Text>
          </View>

          {/* Pricing */}
          <View style={styles.pricingSection}>
            <View style={styles.priceRow}>
              <Text variant='body' size='sm' color='secondary' style={styles.originalPrice}>
                {formatPrice(offer.pricing.originalPrice, offer.pricing.currency || 'EUR')}
              </Text>
              <View style={[styles.discountBadge, { backgroundColor: theme.colors.error }]}>
                <Text variant='label' size='xs' weight='bold' style={{ color: '#fff' }}>
                  -{offer.pricing.discountPercentage || 0}%
                </Text>
              </View>
            </View>
            <Text variant='headline' size='lg' weight='bold' color='primary'>
              {formatPrice(offer.pricing.discountedPrice, offer.pricing.currency || 'EUR')}
            </Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text variant='headline' size='md' weight='semibold' style={styles.sectionTitle}>
              Description
            </Text>
            <Text variant='body' size='md' color='secondary'>
              {offer.description}
            </Text>
          </View>

          {/* Availability */}
          <View style={styles.section}>
            <Text variant='headline' size='md' weight='semibold' style={styles.sectionTitle}>
              Availability
            </Text>
            <Text variant='body' size='sm' color='secondary'>
              <Text weight='semibold'>Available from:</Text> {formatDate(offer.availableFrom)}
            </Text>
            <Text variant='body' size='sm' color='secondary' style={{ marginTop: 4 }}>
              <Text weight='semibold'>Available until:</Text> {formatDate(offer.availableUntil)}
            </Text>
            <Text variant='body' size='sm' color='secondary' style={{ marginTop: 4 }}>
              <Text weight='semibold'>Remaining:</Text> {availableQty} of {offer.totalQuantity}
            </Text>
          </View>

          {/* Pickup Time Slots */}
          {Array.isArray(offer.pickupTimeSlots) && offer.pickupTimeSlots.length > 0 && (
            <View style={styles.section}>
              <Text variant='headline' size='md' weight='semibold' style={styles.sectionTitle}>
                Pickup Time Slots
              </Text>
              {offer.pickupTimeSlots.map((slot, index) => (
                <View key={index} style={styles.timeSlot}>
                  <Text variant='body' size='sm' color='secondary'>
                    {slot.startTime} - {slot.endTime}
                  </Text>
                  <Text variant='label' size='xs' color='secondary'>
                    {slot.currentOrders}/{slot.maxOrders} orders
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Categories */}
          {Array.isArray(offer.categories) && offer.categories.length > 0 && (
            <View style={styles.section}>
              <Text variant='headline' size='md' weight='semibold' style={styles.sectionTitle}>
                Categories
              </Text>
              <View style={styles.tagsContainer}>
                {offer.categories.map((category, index) => (
                  <View
                    key={index}
                    style={[styles.tag, { backgroundColor: `${theme.colors.primary}20` }]}
                  >
                    <Text variant='label' size='xs' style={{ color: theme.colors.primary }}>
                      {category}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Nutritional Info */}
          {offer.nutritionalInfo && (
            <View style={styles.section}>
              <Text variant='headline' size='md' weight='semibold' style={styles.sectionTitle}>
                Nutritional Information
              </Text>
              {typeof offer.nutritionalInfo.calories === 'number' &&
                !Number.isNaN(offer.nutritionalInfo.calories) && (
                  <Text variant='body' size='sm' color='secondary'>
                    Calories: {offer.nutritionalInfo.calories} kcal
                  </Text>
                )}
              {offer.nutritionalInfo.allergens && offer.nutritionalInfo.allergens.length > 0 && (
                <Text variant='body' size='sm' color='error' style={{ marginTop: 8 }}>
                  <Text weight='semibold'>Allergens:</Text>{' '}
                  {offer.nutritionalInfo.allergens.join(', ')}
                </Text>
              )}
              {offer.nutritionalInfo.dietaryInfo &&
                offer.nutritionalInfo.dietaryInfo.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {offer.nutritionalInfo.dietaryInfo.map((info, index) => (
                      <View
                        key={index}
                        style={[styles.tag, { backgroundColor: `${theme.colors.success}20` }]}
                      >
                        <Text variant='label' size='xs' style={{ color: theme.colors.success }}>
                          {info}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
            </View>
          )}

          {/* Special Instructions */}
          {offer.specialInstructions != null && offer.specialInstructions.trim() !== '' && (
            <View style={styles.section}>
              <Text variant='headline' size='md' weight='semibold' style={styles.sectionTitle}>
                Special Instructions
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                {offer.specialInstructions}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <Button
              variant='primary'
              size='lg'
              onPress={handleReserve}
              disabled={!canReserve}
              style={styles.button}
            >
              {canReserve ? 'Reserve ' : 'Currently Unavailable'}
            </Button>

            <Button
              variant='outline'
              size='md'
              onPress={() => navigation.goBack()}
              style={styles.button}
            >
              Go Back
            </Button>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imagesCarousel: {
    height: 250,
  },
  offerImage: {
    width: SCREEN_WIDTH,
    height: 250,
  },
  card: {
    margin: 16,
    padding: 20,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  pricingSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  timeSlot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actionsSection: {
    marginTop: 8,
  },
  button: {
    marginTop: 12,
  },
});
