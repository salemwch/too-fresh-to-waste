/**
 * OrderSuccessModal Component
 * Order confirmation modal with pickup code entry.
 *
 * - No green header / success icon / celebratory text
 * - Compact layout that fits without scrolling
 * - Single CTA at the bottom
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
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
  /** When true, shows an inline loading state inside the modal frame */
  loading?: boolean;
  order: Order | null;
  onDismiss: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  visible,
  loading = false,
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

  const showLoading = loading || !order;
  const currency = order?.pricing.currency || 'TND';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={showLoading ? undefined : onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.card}>
            {showLoading ? (
              /* ── Loading state: same card frame, spinner inside ── */
              <View style={styles.loadingContent}>
                <ActivityIndicator size="large" color="#005250" />
                <Text style={styles.loadingText}>Placing your order...</Text>
              </View>
            ) : (
              /* ── Order content: morphs in once data arrives ── */
              <>
                <View style={styles.content}>
                  {/* Order Number */}
                  <View style={styles.orderNumberRow}>
                    <Icon name="receipt-outline" family="Ionicons" size={18} color="#005250" />
                    <Text style={styles.orderNumberLabel}>Order</Text>
                    <Text style={styles.orderNumberText}>{order.orderNumber}</Text>
                  </View>

                  <View style={styles.divider} />

                  {/* Items Summary */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Icon name="bag-check" family="Ionicons" size={18} color="#005250" />
                      <Text style={styles.sectionTitle}>Order Summary</Text>
                    </View>

                    {order.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemLeft}>
                          <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.offerTitle}
                          </Text>
                        </View>
                        <Text style={styles.itemPrice}>
                          {item.totalPrice.toFixed(2)} {currency}
                        </Text>
                      </View>
                    ))}

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>
                        {order.pricing.total.toFixed(2)} {currency}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Pickup Info */}
                  <View style={styles.section}>
                    <View style={styles.pickupInfo}>
                      <View style={styles.pickupRow}>
                        <Icon name="calendar" family="Ionicons" size={16} color="#64748B" />
                        <Text style={styles.pickupText}>
                          {new Date(order.pickupDetails.scheduledDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <View style={styles.pickupRow}>
                        <Icon name="time" family="Ionicons" size={16} color="#64748B" />
                        <Text style={styles.pickupText}>
                          {order.pickupDetails.timeSlot.startTime} - {order.pickupDetails.timeSlot.endTime}
                        </Text>
                      </View>
                      <View style={styles.pickupRow}>
                        <Icon name="location" family="Ionicons" size={16} color="#64748B" />
                        <Text style={styles.pickupText} numberOfLines={1}>
                          {typeof order.establishmentId === 'string'
                            ? 'Restaurant location'
                            : order.establishmentId?.name || 'Restaurant'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Confirm Pickup */}
                  {pickupConfirmed ? (
                    <View style={styles.pickupSuccessRow}>
                      <Icon name="checkmark-circle" family="Ionicons" size={24} color="#10B981" />
                      <Text style={styles.pickupSuccessText}>Pickup confirmed!</Text>
                    </View>
                  ) : isOrderExpired ? (
                    <View style={styles.expiredRow}>
                      <Icon name="timer-off-outline" family="MaterialCommunityIcons" size={24} color="#EF4444" />
                      <View style={styles.expiredTextContainer}>
                        <Text style={styles.expiredTitle}>Order Expired</Text>
                        <Text style={styles.expiredSubtitle}>
                          The pickup window has ended.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.section}>
                      <Text style={styles.pickupCodeHint}>
                        Enter the 6-digit pickup code from the merchant to earn{' '}
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
                        placeholder="------"
                        placeholderTextColor="#ccc"
                        autoFocus={false}
                        editable={!confirmMutation.isPending}
                        textAlign="center"
                        accessibilityLabel="Pickup code input"
                      />

                      {pickupError ? (
                        <View style={styles.inlineError}>
                          <Icon name="alert-circle" family="Ionicons" size={14} color="#EF4444" />
                          <Text style={styles.inlineErrorText}>{PICKUP_ERROR_MESSAGES[pickupError]}</Text>
                        </View>
                      ) : (
                        <Text style={styles.codeInputFootnote}>
                          You can also enter this later from your orders tab.
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
                          {confirmMutation.isPending ? 'Confirming...' : 'Confirm Pickup'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Footer CTA */}
                <View style={styles.footer}>
                  <Pressable onPress={onDismiss} style={styles.ctaButtonWrapper}>
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
              </>
            )}
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

  // Loading state
  loadingContent: {
    padding: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },

  // Content
  content: {
    padding: 20,
  },

  // Order Number — compact inline row
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumberLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  orderNumberText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#005250',
    letterSpacing: 0.5,
  },

  // Section
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#005250',
    marginRight: 8,
    minWidth: 24,
  },
  itemName: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#005250',
  },

  // Pickup Info
  pickupInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 8,
    fontWeight: '500',
    flex: 1,
  },

  // Confirm Pickup
  pickupCodeHint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 18,
  },
  codeInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 8,
    backgroundColor: '#FAFAFA',
    color: '#1F2937',
  },
  codeInputError: {
    borderColor: '#EF4444',
  },
  codeInputFootnote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  inlineErrorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  confirmPickupButton: {
    marginTop: 12,
    backgroundColor: '#005250',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmPickupButtonDisabled: {
    opacity: 0.5,
  },
  confirmPickupButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickupSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  pickupSuccessText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  expiredTextContainer: {
    flex: 1,
    gap: 2,
  },
  expiredTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  expiredSubtitle: {
    fontSize: 12,
    color: '#991B1B',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },

  // Footer
  footer: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  ctaButtonWrapper: {
    borderRadius: 16,
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
