/**
 * OrderCard Component
 * Premium order list card matching the check.md design spec.
 *
 * Layout (top → bottom):
 *   ┌────────────────────────────────────────┐
 *   │ [IMG]  Title               [STATUS]    │  ← absolute badge top-right
 *   │        Establishment                   │
 *   │        #ORD-XXXX                       │
 *   │                                        │
 *   │  clock  Pickup Today: 14:00 - 16:00    │  ← pulsing dot if within window
 *   │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
 *   │  2× Bags    ~~24.00~~  12.00 TND       │  ← strikethrough original
 *   └────────────────────────────────────────┘
 *
 * Interactions:
 *   - Android: Ripple effect via Pressable android_ripple
 *   - iOS: Opacity feedback via Pressable style callback
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Animated,
} from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';

import { OrderStatus, getEstablishmentName, getEstablishmentImage, getOfferImage } from '../types/order.types';

import type { Order } from '../types/order.types';

// ---------------------------------------------------------------------------
// Status config — colours & labels
// ---------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  bg: string;
  text: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  [OrderStatus.PENDING]:          { label: 'Pending',    bg: '#FEF3C7', text: '#92400E' },
  [OrderStatus.RESERVED]:         { label: 'Reserved',   bg: '#DBEAFE', text: '#1E40AF' },
  [OrderStatus.CONFIRMED]:        { label: 'Confirmed',  bg: '#DBEAFE', text: '#1E40AF' },
  [OrderStatus.READY_FOR_PICKUP]: { label: 'Ready',      bg: '#D1FAE5', text: '#065F46' },
  [OrderStatus.PICKED_UP]:        { label: 'Picked Up',  bg: '#D1FAE5', text: '#065F46' },
  [OrderStatus.CANCELLED]:        { label: 'Cancelled',  bg: '#FEE2E2', text: '#991B1B' },
  [OrderStatus.EXPIRED]:          { label: 'Expired',    bg: '#F3F4F6', text: '#6B7280' },
  [OrderStatus.REFUNDED]:         { label: 'Refunded',   bg: '#F3F4F6', text: '#6B7280' },
};

const DEFAULT_STATUS: StatusConfig = { label: 'Unknown', bg: '#F3F4F6', text: '#6B7280' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if current time is within the pickup window */
function isWithinPickupWindow(order: Order): boolean {
  try {
    const timeSlot = order.pickupDetails?.timeSlot;
    if (!timeSlot?.startTime || !timeSlot?.endTime || !order.pickupDetails?.scheduledDate) {
      return false;
    }

    const now = new Date();
    const scheduledDate = new Date(order.pickupDetails.scheduledDate);

    // Only check if it's the same day
    if (
      now.getFullYear() !== scheduledDate.getFullYear() ||
      now.getMonth() !== scheduledDate.getMonth() ||
      now.getDate() !== scheduledDate.getDate()
    ) {
      return false;
    }

    const startParts = timeSlot.startTime.split(':').map(Number);
    const endParts = timeSlot.endTime.split(':').map(Number);
    const startH = startParts[0];
    const startM = startParts[1];
    const endH = endParts[0];
    const endM = endParts[1];

    if (startH == null || startM == null || endH == null || endM == null) {
      return false;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  } catch {
    return false;
  }
}

/** Format pickup date label */
function formatPickupDate(scheduledDate: string | undefined): string {
  if (!scheduledDate) return '';
  try {
    const date = new Date(scheduledDate);
    const now = new Date();

    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return scheduledDate;
  }
}

// ---------------------------------------------------------------------------
// Pulsing Dot (for "Go now!" indicator)
// ---------------------------------------------------------------------------

const PulsingDot: React.FC = () => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[styles.pulsingDot, { opacity: pulseAnim }]}
    />
  );
};

// ---------------------------------------------------------------------------
// OrderCard
// ---------------------------------------------------------------------------

interface OrderCardProps {
  order: Order;
  onPress: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = React.memo(({ order, onPress }) => {
  const statusConfig = STATUS_CONFIG[order.status] ?? DEFAULT_STATUS;
  const establishmentName = getEstablishmentName(order);

  // Prefer offer image, fall back to establishment image
  const offerImage = getOfferImage(order);
  const establishmentImage = getEstablishmentImage(order);
  const cardImage = offerImage ?? establishmentImage;

  if (__DEV__) {
    console.log(`[OrderCard] #${order.orderNumber} image debug:`, {
      offerImage,
      establishmentImage,
      offerId: order.items?.[0]?.offerId,
      establishmentId: typeof order.establishmentId === 'object'
        ? { name: order.establishmentId.name, images: order.establishmentId.images }
        : order.establishmentId,
    });
  }

  const firstItem = order.items[0];
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const currency = order.pricing.currency;

  const pickupDetails = order.pickupDetails;
  const timeSlot = pickupDetails?.timeSlot;
  const startTime = timeSlot?.startTime;
  const endTime = timeSlot?.endTime;

  const withinPickupWindow = useMemo(() => isWithinPickupWindow(order), [order]);
  const pickupDateLabel = useMemo(
    () => formatPickupDate(pickupDetails?.scheduledDate),
    [pickupDetails?.scheduledDate],
  );

  // Original price (before discount) for strikethrough
  const originalTotal = order.items.reduce((sum, item) => sum + item.originalPrice, 0);
  const hasDiscount = originalTotal > order.pricing.total && order.pricing.discountAmount > 0;

  return (
    <Pressable
      onPress={() => onPress(order)}
      android_ripple={{ color: 'rgba(0, 82, 80, 0.08)', borderless: false }}
      style={({ pressed }) => [
        styles.card,
        Platform.OS === 'ios' && pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.orderNumber}, ${firstItem?.offerTitle ?? 'Order'}, status ${statusConfig.label}`}
      accessibilityHint="Tap to view order details"
    >
      {/* ── Status Badge (absolute top-right) ── */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: statusConfig.bg },
        ]}
      >
        <Text style={[styles.statusText, { color: statusConfig.text }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* ── Top Row: Image + Info ── */}
      <View style={styles.topRow}>
        {/* Thumbnail — offer image preferred, establishment image fallback */}
        {cardImage ? (
          <Image
            source={{ uri: cardImage }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Icon name="fast-food" family="Ionicons" size={28} color="#94A3B8" />
          </View>
        )}

        {/* Info */}
        <View style={styles.infoColumn}>
          <Text style={styles.offerTitle} numberOfLines={1}>
            {firstItem?.offerTitle ?? 'Surprise Bag'}
          </Text>
          <Text style={styles.establishmentName} numberOfLines={1}>
            {establishmentName}
          </Text>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        </View>
      </View>

      {/* ── Pickup Time Row ── */}
      {startTime && endTime ? (
        <View style={styles.pickupRow}>
          <Icon name="time-outline" family="Ionicons" size={16} color="#64748B" />
          <Text style={styles.pickupText}>
            Pickup {pickupDateLabel}: {startTime} - {endTime}
          </Text>
          {withinPickupWindow && (
            <View style={styles.goNowContainer}>
              <PulsingDot />
              <Text style={styles.goNowText}>Go now!</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.pickupRow}>
          <Icon name="time-outline" family="Ionicons" size={16} color="#94A3B8" />
          <Text style={styles.pickupText}>Pickup time pending</Text>
        </View>
      )}

      {/* ── Dashed Divider ── */}
      <View style={styles.dashedDivider} />

      {/* ── Bottom Row: Quantity + Pricing ── */}
      <View style={styles.bottomRow}>
        <Text style={styles.quantityText}>
          {totalQuantity}x {totalQuantity === 1 ? 'Bag' : 'Bags'}
        </Text>

        <View style={styles.priceContainer}>
          {hasDiscount && (
            <Text style={styles.originalPrice}>
              {originalTotal.toFixed(2)}
            </Text>
          )}
          <Text style={styles.activePrice}>
            {order.pricing.total.toFixed(2)} {currency}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

OrderCard.displayName = 'OrderCard';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardPressed: {
    opacity: 0.85,
  },

  // Status badge — absolute top-right
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingRight: 80, // Space for absolute status badge
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoColumn: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 22,
  },
  establishmentName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },

  // Pickup row
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 6,
    flex: 1,
  },
  goNowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  goNowText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },

  // Dashed divider
  dashedDivider: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  activePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#005250',
  },
});
