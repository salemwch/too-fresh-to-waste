/**
 * OrderSuccessModal Component
 * Order confirmation modal with pickup code entry.
 *
 * - No green header / success icon / celebratory text
 * - Compact layout that fits without scrolling
 * - Single CTA at the bottom
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';

import { ordersService } from '../services/ordersService';
import { isPickupError } from '../types/order.types';

import { getEstablishmentName } from '../types/order.types';
import { getPickupErrorKey, type InlinePickupError } from '../utils/orderStatus';

import type { Order } from '../types/order.types';

interface PickupState {
  orderId: string | null;
  code: string;
  pickupError: InlinePickupError | null;
  pickupConfirmed: boolean;
}

const SURFACE = '#FFFFFF';
const OVERLAY = 'rgba(0, 0, 0, 0.65)';
const SHADOW = '#000';
const TEXT_PRIMARY = '#1F2937';
const TEXT_MUTED = '#475569';
const TEXT_SECONDARY = '#64748B';
const TEXT_TERTIARY = '#94A3B8';
const BORDER = '#E2E8F0';
const SURFACE_MUTED = '#F1F5F9';
const SURFACE_SUBTLE = '#F8FAFC';
const INPUT_SURFACE = '#FAFAFA';
const PRIMARY = colorTokens.base.primary[500];
const SUCCESS = colorTokens.base.success[500];
const SUCCESS_SURFACE = '#F0FDF4';
const SUCCESS_BORDER = '#D1FAE5';
const SUCCESS_TEXT = '#059669';
const ERROR = colorTokens.base.error[500];
const ERROR_SURFACE = '#FEF2F2';
const ERROR_BORDER = '#FECACA';
const ERROR_TEXT = '#991B1B';
const WHITE = '#FFFFFF';

const createPickupState = (orderId: string | null): PickupState => ({
  orderId,
  code: '',
  pickupError: null,
  pickupConfirmed: false,
});

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
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const activeOrderId = order?._id ?? null;
  const [pickupState, setPickupState] = useState<PickupState>(() =>
    createPickupState(activeOrderId),
  );
  const currentPickupState =
    pickupState.orderId === activeOrderId ? pickupState : createPickupState(activeOrderId);
  const { code, pickupError, pickupConfirmed } = currentPickupState;
  const pickupCodeAccentStyle = { color: theme.colors.primary };
  const updatePickupState = useCallback(
    (updater: (state: PickupState) => PickupState) => {
      setPickupState(prev => {
        const base = prev.orderId === activeOrderId ? prev : createPickupState(activeOrderId);
        return updater(base);
      });
    },
    [activeOrderId],
  );

  // Time-based expiry check
  const isOrderExpired = useMemo(() => {
    if (!order) return false;
    if (order.expiresAt) {
      return new Date() > new Date(order.expiresAt);
    }
    return false;
  }, [order]);

  const confirmMutation = useMutation({
    mutationFn: (pickupCode: string) => ordersService.confirmPickup(order!._id, { pickupCode }),
    onSuccess: () => {
      updatePickupState(state => ({
        ...state,
        pickupConfirmed: true,
        code: '',
        pickupError: null,
      }));
      void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', order?._id] });
    },
    onError: error => {
      const nextError = isPickupError(error) ? error.code : 'INVALID_CODE';
      updatePickupState(state => ({
        ...state,
        pickupError: nextError,
      }));
    },
  });

  const handleConfirmPickup = useCallback(() => {
    updatePickupState(state => ({
      ...state,
      pickupError: null,
    }));
    confirmMutation.mutate(code);
  }, [code, confirmMutation, updatePickupState]);

  const handleCodeChange = useCallback(
    (text: string) => {
      updatePickupState(state => ({
        ...state,
        code: text,
        pickupError: null,
      }));
    },
    [updatePickupState],
  );

  const showLoading = loading || !order;
  const currency = order?.pricing?.currency ?? 'TND';

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      statusBarTranslucent
      onRequestClose={showLoading ? undefined : onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.card}>
            {showLoading ? (
              /* ── Loading state: same card frame, spinner inside ── */
              <View style={styles.loadingContent}>
                <ActivityIndicator size='large' color={PRIMARY} />
                <Text style={styles.loadingText}>{t('checkout.placingOrder')}</Text>
              </View>
            ) : (
              /* ── Order content: morphs in once data arrives ── */
              <>
                <View style={styles.content}>
                  {/* Order Number */}
                  <View style={styles.orderNumberRow}>
                    <Icon name='receipt-outline' family='Ionicons' size={18} color={PRIMARY} />
                    <Text style={styles.orderNumberLabel}>{t('orders.order')}</Text>
                    <Text style={styles.orderNumberText}>{order.orderNumber}</Text>
                  </View>

                  <View style={styles.divider} />

                  {/* Items Summary */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Icon name='bag-check' family='Ionicons' size={18} color={PRIMARY} />
                      <Text style={styles.sectionTitle}>{t('checkout.orderSummary')}</Text>
                    </View>

                    {(order.items ?? []).map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemLeft}>
                          <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.offerTitle}
                          </Text>
                        </View>
                        <Text style={styles.itemPrice}>
                          {(item.totalPrice ?? 0).toFixed(2)} {currency}
                        </Text>
                      </View>
                    ))}

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>{t('common.total')}</Text>
                      <Text style={styles.totalValue}>
                        {(order.pricing?.total ?? 0).toFixed(2)} {currency}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Pickup Info */}
                  <View style={styles.section}>
                    <View style={styles.pickupInfo}>
                      <View style={styles.pickupRow}>
                        <Icon name='calendar' family='Ionicons' size={16} color='#64748B' />
                        <Text style={styles.pickupText}>
                          {order.pickupDetails?.scheduledDate
                            ? new Date(order.pickupDetails.scheduledDate).toLocaleDateString(
                                'en-US',
                                {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                },
                              )
                            : '—'}
                        </Text>
                      </View>
                      <View style={styles.pickupRow}>
                        <Icon name='time' family='Ionicons' size={16} color='#64748B' />
                        <Text style={styles.pickupText}>
                          {order.pickupDetails?.timeSlot?.startTime ?? '—'} -{' '}
                          {order.pickupDetails?.timeSlot?.endTime ?? '—'}
                        </Text>
                      </View>
                      <View style={styles.pickupRow}>
                        <Icon name='location' family='Ionicons' size={16} color='#64748B' />
                        <Text style={styles.pickupText} numberOfLines={1}>
                          {getEstablishmentName(order)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Confirm Pickup */}
                  {pickupConfirmed ? (
                    <View style={styles.pickupSuccessRow}>
                      <Icon name='checkmark-circle' family='Ionicons' size={24} color={SUCCESS} />
                      <Text style={styles.pickupSuccessText}>{t('orders.pickupConfirmed')}</Text>
                    </View>
                  ) : isOrderExpired ? (
                    <View style={styles.expiredRow}>
                      <Icon
                        name='timer-outline'
                        family='Ionicons'
                        size={24}
                        color={colorTokens.base.error[500]}
                      />
                      <View style={styles.expiredTextContainer}>
                        <Text style={styles.expiredTitle}>{t('orders.orderExpired')}</Text>
                        <Text style={styles.expiredSubtitle}>{t('orders.pickupWindowEnded')}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.section}>
                      <Text style={styles.pickupCodeHint}>
                        <Trans
                          i18nKey='orders.pickupCodeHintModal'
                          components={{
                            accent: (
                              <Text style={[styles.pickupCodeAccent, pickupCodeAccentStyle]} />
                            ),
                          }}
                        />
                      </Text>

                      <TextInput
                        style={[styles.codeInput, pickupError && styles.codeInputError]}
                        value={code}
                        onChangeText={handleCodeChange}
                        keyboardType='numeric'
                        maxLength={6}
                        placeholder={t('orders.codePlaceholderDashes')}
                        placeholderTextColor='#ccc'
                        autoFocus={false}
                        editable={!confirmMutation.isPending}
                        textAlign='center'
                        accessibilityLabel={t('orders.confirmPickupButton')}
                        accessibilityHint={t('orders.confirmPickupHint')}
                      />

                      {pickupError ? (
                        <View style={styles.inlineError}>
                          <Icon
                            name='alert-circle'
                            family='Ionicons'
                            size={14}
                            color={colorTokens.base.error[500]}
                          />
                          <Text style={styles.inlineErrorText}>
                            {t(getPickupErrorKey(pickupError))}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.codeInputFootnote}>{t('orders.enterLater')}</Text>
                      )}

                      <Pressable
                        accessibilityRole='button'
                        onPress={handleConfirmPickup}
                        disabled={code.length !== 6 || confirmMutation.isPending}
                        style={[
                          styles.confirmPickupButton,
                          (code.length !== 6 || confirmMutation.isPending) &&
                            styles.confirmPickupButtonDisabled,
                        ]}
                      >
                        <Text style={styles.confirmPickupButtonText}>
                          {confirmMutation.isPending
                            ? t('orders.confirming')
                            : t('orders.confirmPickupButton')}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Footer CTA */}
                <View style={styles.footer}>
                  <Pressable
                    accessibilityRole='button'
                    onPress={onDismiss}
                    style={styles.ctaButtonWrapper}
                  >
                    <LinearGradient
                      colors={[PRIMARY, colorTokens.base.primary[400]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaButton}
                    >
                      <Text style={styles.ctaButtonText}>
                        {pickupConfirmed ? t('common.close') : t('orders.viewMyOrder')}
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
    backgroundColor: OVERLAY,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        overflow: 'hidden' as const,
        shadowColor: SHADOW,
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
    color: TEXT_MUTED,
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
    color: TEXT_SECONDARY,
  },
  orderNumberText: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
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
    color: TEXT_PRIMARY,
    marginStart: 8,
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
    marginEnd: 12,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
    marginEnd: 8,
    minWidth: 24,
  },
  itemName: {
    fontSize: 14,
    color: TEXT_MUTED,
    fontWeight: '500',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: BORDER,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: PRIMARY,
  },

  // Pickup Info
  pickupInfo: {
    backgroundColor: SURFACE_SUBTLE,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupText: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginStart: 8,
    fontWeight: '500',
    flex: 1,
  },

  // Confirm Pickup
  pickupCodeHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 10,
    lineHeight: 18,
  },
  pickupCodeAccent: {
    fontWeight: '700',
  },
  codeInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 8,
    backgroundColor: INPUT_SURFACE,
    color: TEXT_PRIMARY,
  },
  codeInputError: {
    borderColor: ERROR,
  },
  codeInputFootnote: {
    fontSize: 11,
    color: TEXT_TERTIARY,
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
    color: ERROR,
    fontWeight: '500',
  },
  confirmPickupButton: {
    marginTop: 12,
    backgroundColor: PRIMARY,
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
    color: WHITE,
  },
  pickupSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SUCCESS_SURFACE,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
  },
  pickupSuccessText: {
    fontSize: 15,
    fontWeight: '700',
    color: SUCCESS_TEXT,
  },
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: ERROR_SURFACE,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ERROR_BORDER,
  },
  expiredTextContainer: {
    flex: 1,
    gap: 2,
  },
  expiredTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ERROR,
  },
  expiredSubtitle: {
    fontSize: 12,
    color: ERROR_TEXT,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },

  // Footer
  footer: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SURFACE_MUTED,
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
        shadowColor: PRIMARY,
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
    color: WHITE,
    letterSpacing: 0.3,
  },
});
