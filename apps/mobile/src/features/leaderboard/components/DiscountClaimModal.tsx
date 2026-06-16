/**
 * DiscountClaimModal — Bottom-sheet for rank 6+ users to select a partner
 * establishment and claim their 10% discount prize.
 *
 * UX states:
 *  1. Loading — skeleton placeholder cards while establishments load
 *  2. Selecting — scrollable list with selection highlight
 *  3. Claiming — button disabled with ActivityIndicator
 *  4. Claimed (hasClaimed=true) — voucher card with details
 *  5. Error — red banner above the CTA button
 *  6. Empty — no partner businesses available
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';
import { getOptimizedImageUrl, IMAGE_PRESETS } from '@/utils/imageTransform';

import type { PrizeClaimResponse } from '@foodwaste/shared';

// ─── Color constants (mirrors LeaderboardScreen / WinnerCelebrationModal) ────
const PRIMARY = colorTokens.base.primary[500];
const GOLD_TEXT = '#B45309';
const SURFACE = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';
const OVERLAY = 'rgba(0,0,0,0.45)';
const INVERSE_TEXT = '#FFFFFF';
const ERROR = '#DC2626';
const AMBER_BG = '#FEF3C7';
const AMBER_TEXT = '#92400E';

// ─── Local type for establishment list items ────────────────────────────────
interface EstablishmentItem {
  _id: string;
  name: string;
  type: string;
  images: string[];
  address?: {
    city?: string;
  };
}

interface EstablishmentListResponse {
  data: EstablishmentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface DiscountClaimModalProps {
  visible: boolean;
  onClose: () => void;
  rank: number;
  hasClaimed: boolean;
  claimData: PrizeClaimResponse | null;
  onClaim: (establishmentId: string) => void;
  isClaiming: boolean;
  error: string | null;
  firstName: string;
}

// ─── Component ──────────────────────────────────────────────────────────────
export const DiscountClaimModal: React.FC<DiscountClaimModalProps> = ({
  visible,
  onClose,
  rank: _rank,
  hasClaimed,
  claimData,
  onClaim,
  isClaiming,
  error,
  firstName,
}) => {
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, 24);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch active establishments
  const { data: establishmentResult, isLoading } = useQuery({
    queryKey: ['establishments', 'active'],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<BackendApiResponse<EstablishmentListResponse>>(
        '/establishments',
        { params: { status: 'active', limit: 50 }, signal },
      );
      return unwrapBackendResponse(response, 'establishments');
    },
    enabled: visible && !hasClaimed,
    staleTime: 5 * 60_000,
  });

  const establishments = establishmentResult?.data ?? [];

  // Derive the selected establishment name for the button label
  const selectedName = establishments.find(e => e._id === selectedId)?.name;

  // Status label for claimed voucher
  const statusLabel =
    claimData?.status === 'verified'
      ? 'Verified'
      : claimData?.status === 'delivered'
        ? 'Delivered'
        : 'Pending';

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
        accessibilityRole='button'
        accessibilityLabel='Close discount modal'
        accessibilityHint='Closes the discount claim sheet'
      >
        <Pressable
          style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}
          accessibilityRole='none'
          onPress={() => undefined}
        >
          <View style={styles.modalHandle} />

          {/* Title */}
          <Text style={styles.heading}>
            {hasClaimed ? 'Your Discount Voucher' : 'Choose a Business'}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {hasClaimed ? (
              /* ── Claimed voucher card ── */
              <View style={styles.voucherCard}>
                <Text style={styles.voucherEstName}>
                  {claimData?.establishmentName ?? 'Partner Business'}
                </Text>
                <Text style={styles.voucherDiscount}>10% Discount</Text>
                <Text style={styles.voucherUser}>{firstName}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                </View>
                <Text style={styles.voucherNote}>
                  Present this to the establishment to redeem your discount.
                </Text>
              </View>
            ) : isLoading ? (
              /* ── Loading skeletons ── */
              <>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={styles.skeletonRow}>
                    <View style={styles.skeletonAvatar} />
                    <View style={styles.skeletonTextGroup}>
                      <View style={styles.skeletonName} />
                      <View style={styles.skeletonSub} />
                    </View>
                  </View>
                ))}
              </>
            ) : establishments.length === 0 ? (
              /* ── Empty state ── */
              <View style={styles.emptyState}>
                <Icon name='storefront-outline' family='Ionicons' size={48} color={TEXT_TERTIARY} />
                <Text style={styles.emptyHeading}>No partner businesses available</Text>
                <Text style={styles.emptySubtext}>
                  Please check back later for eligible establishments.
                </Text>
              </View>
            ) : (
              /* ── Establishment list ── */
              <>
                {establishments.map(est => {
                  const isSelected = selectedId === est._id;
                  const imageUri =
                    est.images.length > 0
                      ? getOptimizedImageUrl(est.images[0], IMAGE_PRESETS.avatar)
                      : undefined;
                  const initials = est.name.slice(0, 2).toUpperCase();

                  return (
                    <Pressable
                      key={est._id}
                      style={[styles.estRow, isSelected && styles.estRowSelected]}
                      onPress={() => setSelectedId(est._id)}
                      accessibilityRole='button'
                      accessibilityLabel={`Select ${est.name}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      {/* Avatar */}
                      {imageUri != null ? (
                        <FastImage
                          source={{ uri: imageUri, priority: FastImage.priority.normal }}
                          style={styles.estAvatar}
                        />
                      ) : (
                        <View style={[styles.estAvatar, styles.estAvatarFallback]}>
                          <Text style={styles.estAvatarInitials}>{initials}</Text>
                        </View>
                      )}

                      {/* Info */}
                      <View style={styles.estInfo}>
                        <Text style={styles.estName} numberOfLines={1}>
                          {est.name}
                        </Text>
                        <View style={styles.estMetaRow}>
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{est.type}</Text>
                          </View>
                          {est.address?.city != null && (
                            <Text style={styles.estCity} numberOfLines={1}>
                              {est.address.city}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Check indicator */}
                      {isSelected && (
                        <Icon name='checkmark-circle' family='Ionicons' size={22} color={PRIMARY} />
                      )}
                    </Pressable>
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* ── Error banner ── */}
          {error != null && !hasClaimed && (
            <View style={styles.errorBanner}>
              <Icon name='alert-circle-outline' family='Ionicons' size={18} color={ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Fixed bottom button ── */}
          {hasClaimed ? (
            <Pressable
              style={styles.modalBtn}
              onPress={onClose}
              accessibilityRole='button'
              accessibilityLabel='Got it'
              accessibilityHint='Dismisses the voucher view'
            >
              <Text style={styles.modalBtnTxt}>Got it</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.modalBtn,
                (selectedId == null || isClaiming) && styles.modalBtnDisabled,
              ]}
              onPress={() => {
                if (selectedId != null) {
                  onClaim(selectedId);
                }
              }}
              disabled={selectedId == null || isClaiming}
              accessibilityRole='button'
              accessibilityLabel={
                selectedName != null
                  ? `Claim 10% Discount at ${selectedName}`
                  : 'Select a business first'
              }
              accessibilityHint='Claims your 10% discount at the selected business'
            >
              {isClaiming ? (
                <ActivityIndicator size='small' color={INVERSE_TEXT} />
              ) : (
                <Text style={styles.modalBtnTxt}>
                  {selectedName != null
                    ? `Claim 10% Discount at ${selectedName}`
                    : 'Select a Business'}
                </Text>
              )}
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Modal shell ──
  modalOverlay: {
    flex: 1,
    backgroundColor: OVERLAY,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // ── Heading ──
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 16,
  },

  // ── Establishment row ──
  estRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  estRowSelected: {
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}08`,
  },
  estAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  estAvatarFallback: {
    backgroundColor: `${PRIMARY}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estAvatarInitials: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
  },
  estInfo: {
    flex: 1,
    marginLeft: 12,
  },
  estName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  estMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 8,
  },
  typeBadge: {
    backgroundColor: `${PRIMARY}12`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: PRIMARY,
    textTransform: 'capitalize',
  },
  estCity: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },

  // ── Loading skeletons ──
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  skeletonTextGroup: {
    marginLeft: 12,
    gap: 6,
  },
  skeletonName: {
    width: 120,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  skeletonSub: {
    width: 80,
    height: 10,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 240,
  },

  // ── Voucher card (claimed state) ──
  voucherCard: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BORDER,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  voucherEstName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  voucherDiscount: {
    fontSize: 28,
    fontWeight: '800',
    color: GOLD_TEXT,
    textAlign: 'center',
    marginBottom: 8,
  },
  voucherUser: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: AMBER_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER_TEXT,
  },
  voucherNote: {
    fontSize: 13,
    color: TEXT_TERTIARY,
    textAlign: 'center',
    lineHeight: 19,
  },

  // ── Error banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: ERROR,
    lineHeight: 18,
  },

  // ── Button ──
  modalBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: INVERSE_TEXT,
  },
});
