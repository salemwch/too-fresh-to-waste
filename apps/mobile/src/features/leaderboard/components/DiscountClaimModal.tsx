/**
 * DiscountClaimModal — Bottom-sheet for rank 6+ users to select a partner
 * establishment and claim their 10% discount prize.
 *
 * UX states:
 *  1. Loading — skeleton placeholder cards while establishments load
 *  2. Selecting — search + paginated list with selection highlight
 *  3. Claiming — button disabled with ActivityIndicator
 *  4. Claimed (hasClaimed=true) — voucher card with code + establishment name
 *  5. Error — red banner above the CTA button
 *  6. Empty — no partner businesses available
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
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
const SUCCESS_BG = '#F0FDF4';
const SUCCESS_TEXT = '#166534';
const DELIVERED_BG = '#EFF6FF';
const DELIVERED_TEXT = '#1E40AF';

const PAGE_SIZE = 5;

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

interface EstablishmentPage {
  establishments: EstablishmentItem[];
  total: number;
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

// ─── Debounce hook ──────────────────────────────────────────────────────────
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
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
  const [searchText, setSearchText] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const searchInputRef = useRef<TextInput>(null);

  const debouncedSearch = useDebouncedValue(searchText, 300);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setSelectedId(null);
  }, [debouncedSearch]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible && !hasClaimed) {
      setSearchText('');
      setVisibleCount(PAGE_SIZE);
      setSelectedId(null);
    }
  }, [visible, hasClaimed]);

  // Fetch active establishments with search + pagination
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['establishments', 'active', debouncedSearch, visibleCount],
    queryFn: async ({ signal }) => {
      const params = {
        status: 'active' as const,
        page: 1,
        limit: visibleCount,
        ...(debouncedSearch.trim().length > 0 ? { search: debouncedSearch.trim() } : {}),
      };
      const response = await apiClient.get<BackendApiResponse<EstablishmentItem[]>>(
        '/establishments',
        { params, signal },
      );
      const establishments = unwrapBackendResponse(
        response,
        'establishments',
      ) as EstablishmentItem[];
      const total = (response.data?.meta?.total as number) ?? establishments.length;
      return { establishments, total } as EstablishmentPage;
    },
    enabled: visible && !hasClaimed,
    staleTime: 60_000,
    placeholderData: prev => prev,
  });

  const establishments = data?.establishments ?? [];
  const total = data?.total ?? 0;
  const hasMore = visibleCount < total;

  // Derive the selected establishment name for the button label
  const selectedName = establishments.find(e => e._id === selectedId)?.name;

  // Status label + colors for claimed voucher
  const statusConfig = useMemo(() => {
    if (claimData?.status === 'verified') {
      return { label: 'Verified', bg: SUCCESS_BG, text: SUCCESS_TEXT };
    }
    if (claimData?.status === 'delivered') {
      return { label: 'Delivered', bg: DELIVERED_BG, text: DELIVERED_TEXT };
    }
    return { label: 'Pending', bg: AMBER_BG, text: AMBER_TEXT };
  }, [claimData?.status]);

  const handleShowMore = useCallback(() => setVisibleCount(c => c + PAGE_SIZE), []);

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

          {/* Search bar — only when selecting */}
          {!hasClaimed && (
            <View style={styles.searchContainer}>
              <Icon name='search-outline' family='Ionicons' size={18} color={TEXT_TERTIARY} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder='Search businesses...'
                placeholderTextColor={TEXT_TERTIARY}
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
                returnKeyType='search'
              />
              {searchText.length > 0 && (
                <Pressable
                  onPress={() => setSearchText('')}
                  hitSlop={8}
                  accessibilityRole='button'
                  accessibilityLabel='Clear search'
                >
                  <Icon name='close-circle' family='Ionicons' size={18} color={TEXT_TERTIARY} />
                </Pressable>
              )}
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps='handled'
          >
            {hasClaimed ? (
              /* ── Claimed voucher card ── */
              <View style={styles.voucherCard}>
                <View style={styles.voucherIconCircle}>
                  <Icon name='gift-outline' family='Ionicons' size={28} color={PRIMARY} />
                </View>
                <Text style={styles.voucherDiscount}>10% Discount</Text>
                <Text style={styles.voucherEstName}>
                  {claimData?.establishmentName ?? 'Partner Business'}
                </Text>

                {/* Voucher code */}
                {claimData?.voucherCode != null && (
                  <View style={styles.voucherCodeBox}>
                    <Text style={styles.voucherCodeLabel}>VOUCHER CODE</Text>
                    <Text style={styles.voucherCode}>{claimData.voucherCode}</Text>
                  </View>
                )}

                <Text style={styles.voucherUser}>{firstName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                    {statusConfig.label}
                  </Text>
                </View>
                <Text style={styles.voucherNote}>
                  Show this voucher code at the establishment to redeem your discount.
                </Text>
              </View>
            ) : isLoading ? (
              /* ── Loading skeletons ── */
              <>
                {[1, 2, 3, 4, 5].map(i => (
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
                <Text style={styles.emptyHeading}>
                  {debouncedSearch.length > 0
                    ? 'No results found'
                    : 'No partner businesses available'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {debouncedSearch.length > 0
                    ? 'Try a different search term.'
                    : 'Please check back later for eligible establishments.'}
                </Text>
              </View>
            ) : (
              /* ── Establishment list ── */
              <>
                {/* Result count */}
                <Text style={styles.resultCount}>
                  {total} {total === 1 ? 'business' : 'businesses'} found
                </Text>

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

                {/* Show more button */}
                {hasMore && (
                  <Pressable
                    style={styles.showMoreBtn}
                    onPress={handleShowMore}
                    disabled={isFetching}
                    accessibilityRole='button'
                    accessibilityLabel='Show more businesses'
                  >
                    {isFetching ? (
                      <ActivityIndicator size='small' color={PRIMARY} />
                    ) : (
                      <>
                        <Text style={styles.showMoreText}>Show more</Text>
                        <Icon
                          name='chevron-down-outline'
                          family='Ionicons'
                          size={16}
                          color={PRIMARY}
                        />
                      </>
                    )}
                  </Pressable>
                )}
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
                <Text style={styles.modalBtnTxt} numberOfLines={1}>
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

  // ── Search bar ──
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_PRIMARY,
    paddingVertical: 0,
  },

  // ── Result count ──
  resultCount: {
    fontSize: 12,
    color: TEXT_TERTIARY,
    marginBottom: 8,
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

  // ── Show more ──
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    backgroundColor: `${PRIMARY}08`,
    gap: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
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
  voucherIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${PRIMARY}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  voucherDiscount: {
    fontSize: 28,
    fontWeight: '800',
    color: GOLD_TEXT,
    textAlign: 'center',
    marginBottom: 4,
  },
  voucherEstName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 16,
  },
  voucherCodeBox: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  voucherCodeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  voucherCode: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 2,
  },
  voucherUser: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
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
    paddingHorizontal: 20,
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
