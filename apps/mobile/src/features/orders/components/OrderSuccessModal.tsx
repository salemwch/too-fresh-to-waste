/**
 * OrderSuccessModal Component
 * Premium order confirmation modal with manual dismiss
 *
 * ✅ PRODUCT REQUIREMENTS:
 * - Shows after successful order creation
 * - Must be manually dismissed by user (NO auto-dismiss)
 * - Celebratory design with order summary
 * - Clear CTA button with best UX copy
 *
 * 🎨 DESIGN:
 * - Premium gradient header
 * - Success icon/animation
 * - Order summary (number, items, total, pickup time)
 * - Single prominent CTA button
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { ordersService } from '../services/ordersService';
import type { Order, PickupErrorCode } from '../types/order.types';
import { isPickupError } from '../types/order.types';

type InlinePickupError = PickupErrorCode | 'INVALID_CODE';

const PICKUP_ERROR_MESSAGES: Record<InlinePickupError, string> = {
  CODE_EXPIRED:         'Pickup code has expired',
  INVALID_CODE:         'Invalid pickup code',
  PICKUP_ALREADY_DONE:  'This order has already been picked up.',
  PICKUP_LOCKED:        'Too many incorrect attempts. Contact support.',
  ORDER_NOT_READY:      'Order not ready yet. Try again shortly.',
};

interface OrderSuccessModalProps {
  visible: boolean;
  order: Order | null;
  onDismiss: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  visible,
  order,
  onDismiss,
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [pickupError, setPickupError] = useState<InlinePickupError | null>(null);
  const [pickupConfirmed, setPickupConfirmed] = useState(false);

  // Reset pickup state whenever a new order lands in the modal
  useEffect(() => {
    setCode('');
    setPickupError(null);
    setPickupConfirmed(false);
  }, [order?._id]);

  // Time-based expiry check
  const isOrderExpired = React.useMemo(() => {
    if (!order) return false;
    if (order.expiresAt) {
      return new Date() > new Date(order.expiresAt);
    }
    return false;
  }, [order]);

  const confirmMutation = useMutation({
    mutationFn: (pickupCode: string) => ordersService.confirmPickup(order!._id, { pickupCode }),
    onSuccess: () => {
      setPickupConfirmed(true);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', order?._id] });
    },
    onError: (error) => {
      if (isPickupError(error)) {
        setPickupError(error.code);
      } else {
        setPickupError('INVALID_CODE');
      }
    },
  });

  const handleConfirmPickup = useCallback(() => {
    setPickupError(null);
    confirmMutation.mutate(code);
  }, [code, confirmMutation]);

  if (!order) return null;

  // Calculate totals
  const currency = order.pricing.currency || 'TND';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss} // Android back button
    >
      {/* Backdrop */}
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          {/* Content Card */}
          <View style={styles.card}>
            {/* Success Header with Gradient */}
            <LinearGradient
              colors={['#10B981', '#059669', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              {/* Success Icon */}
              <View style={styles.iconContainer}>
                <Icon name="checkmark-circle" family="Ionicons" size={64} color="#FFFFFF" />
              </View>

              {/* Success Title */}
              <Text style={styles.title}>Order Confirmed!</Text>
              <Text style={styles.subtitle}>Your surprise bag is reserved</Text>
            </LinearGradient>

            {/* Order Details */}
            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Order Number */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="receipt-outline" family="Ionicons" size={20} color="#005250" />
                  <Text style={styles.sectionTitle}>Order Number</Text>
                </View>
                <View style={styles.orderNumberBadge}>
                  <Text style={styles.orderNumberText}>{order.orderNumber}</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Items Summary */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="bag-check" family="Ionicons" size={20} color="#005250" />
                  <Text style={styles.sectionTitle}>Order Summary</Text>
                </View>

                {order.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemQuantity}>{item.quantity}×</Text>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.offerTitle}
                      </Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      {item.totalPrice.toFixed(2)} {currency}
                    </Text>
                  </View>
                ))}

                {/* Total */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    {order.pricing.total.toFixed(2)} {currency}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Pickup Information */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="time-outline" family="Ionicons" size={20} color="#005250" />
                  <Text style={styles.sectionTitle}>Pickup Details</Text>
                </View>

                <View style={styles.pickupInfo}>
                  <View style={styles.pickupRow}>
                    <Icon name="calendar" family="Ionicons" size={18} color="#64748B" />
                    <Text style={styles.pickupText}>
                      {new Date(order.pickupDetails.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.pickupRow}>
                    <Icon name="time" family="Ionicons" size={18} color="#64748B" />
                    <Text style={styles.pickupText}>
                      {order.pickupDetails.timeSlot.startTime} -{' '}
                      {order.pickupDetails.timeSlot.endTime}
                    </Text>
                  </View>
                  <View style={styles.pickupRow}>
                    <Icon name="location" family="Ionicons" size={18} color="#64748B" />
                    <Text style={styles.pickupText} numberOfLines={2}>
                      {typeof order.establishmentId === 'string'
                        ? 'Restaurant location'
                        : order.establishmentId?.name || 'Restaurant'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Confirm Pickup */}
              {pickupConfirmed ? (
                <View style={styles.section}>
                  <View style={styles.pickupSuccessRow}>
                    <Icon name="checkmark-circle" family="Ionicons" size={28} color="#10B981" />
                    <Text style={styles.pickupSuccessText}>Pickup confirmed!</Text>
                  </View>
                </View>
              ) : isOrderExpired ? (
                <View style={styles.section}>
                  <View style={styles.expiredRow}>
                    <Icon name="timer-off-outline" family="MaterialCommunityIcons" size={28} color="#EF4444" />
                    <View style={styles.expiredTextContainer}>
                      <Text style={styles.expiredTitle}>Order Expired</Text>
                      <Text style={styles.expiredSubtitle}>
                        The pickup window has ended. The pickup code is no longer valid.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Icon name="keypad" family="Ionicons" size={20} color="#005250" />
                    <Text style={styles.sectionTitle}>Confirm Pickup</Text>
                  </View>
                  <Text style={styles.pickupCodeHint}>
                    Ask the merchant for the 6-digit pickup code and enter it below to get your{' '}
                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>points</Text>.
                  </Text>

                  <TextInput
                    style={[styles.codeInput, pickupError && styles.codeInputError]}
                    value={code}
                    onChangeText={(text) => {
                      setCode(text);
                      if (pickupError) setPickupError(null);
                    }}
                    keyboardType="numeric"
                    maxLength={6}
                    placeholder="• • • • • •"
                    placeholderTextColor="#aaa"
                    autoFocus={false}
                    editable={!confirmMutation.isPending}
                    textAlign="center"
                    accessibilityLabel="Pickup code input"
                    accessibilityHint="Enter the 6-digit code from the merchant"
                  />

                  {/* Inline error directly under input */}
                  {pickupError ? (
                    <View style={styles.inlineError}>
                      <Icon name="alert-circle" family="Ionicons" size={16} color="#EF4444" />
                      <Text style={styles.inlineErrorText}>{PICKUP_ERROR_MESSAGES[pickupError]}</Text>
                    </View>
                  ) : (
                    <Text style={styles.codeInputFootnote}>
                      You can always find this in your order tab if you close it.
                    </Text>
                  )}

                  <Pressable
                    onPress={handleConfirmPickup}
                    disabled={code.length !== 6 || confirmMutation.isPending}
                    style={[
                      styles.confirmPickupButton,
                      (code.length !== 6 || confirmMutation.isPending) && styles.confirmPickupButtonDisabled,
                    ]}
                  >
                    <Text style={styles.confirmPickupButtonText}>
                      {confirmMutation.isPending ? 'Confirming…' : 'Confirm Pickup'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* Action Button */}
            <View style={styles.footer}>
              <Pressable
                onPress={onDismiss}
                style={styles.ctaButtonWrapper}
              >
                <LinearGradient
                  colors={['#005250', '#007B77']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaButton}
                >
                  <Text style={styles.ctaButtonText}>
                    {pickupConfirmed ? 'Close' : 'View My Order'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  // Header
  header: {
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Scroll Content
  scrollContent: {
    maxHeight: 420,
  },
  scrollContentContainer: {
    padding: 24,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },

  // Order Number
  orderNumberBadge: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    alignItems: 'center',
  },
  orderNumberText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#005250',
    letterSpacing: 1,
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingVertical: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  itemQuantity: {
    fontSize: 15,
    fontWeight: '700',
    color: '#005250',
    marginRight: 10,
    minWidth: 28,
  },
  itemName: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#005250',
    letterSpacing: -0.5,
  },

  // Pickup Info
  pickupInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 10,
    fontWeight: '500',
    flex: 1,
  },

  // Confirm Pickup
  pickupCodeHint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  codeInput: {
    height: 56,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    backgroundColor: '#FAFAFA',
    color: '#1F2937',
  },
  codeInputError: {
    borderColor: '#EF4444',
  },
  codeInputFootnote: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  inlineErrorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  expiredTextContainer: {
    flex: 1,
    gap: 2,
  },
  expiredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  expiredSubtitle: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  confirmPickupButton: {
    marginTop: 16,
    backgroundColor: '#005250',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmPickupButtonDisabled: {
    opacity: 0.5,
  },
  confirmPickupButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  pickupSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  pickupSuccessText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },

  // Footer
  footer: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  ctaButtonWrapper: {
    borderRadius: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#005250',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
});
