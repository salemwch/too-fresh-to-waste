/**
 * WinnerCelebrationModal — Full-screen celebration for top-5 challenge winners.
 *
 * UX states:
 *  1. Initial (not claimed) — trophy + congrats + "Claim Your Prize" CTA
 *  2. Claiming — button disabled with ActivityIndicator
 *  3. Claimed — checkmark + status badge + "Got it" close button
 *  4. Error — initial view with red error banner above the CTA
 *
 * Follows the same bottom-sheet modal pattern as PrizeModal in LeaderboardScreen.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';

import type { PrizeClaimResponse } from '@foodwaste/shared';

// ─── Color constants (leaderboard-specific, mirrors LeaderboardScreen) ───────
const PRIMARY = colorTokens.base.primary[500];
const GOLD_TEXT = '#B45309';
const SUCCESS = '#22C55E';
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

// ─── Props ───────────────────────────────────────────────────────────────────
interface WinnerCelebrationModalProps {
  visible: boolean;
  onClose: () => void;
  rank: number;
  hasClaimed: boolean;
  claimData: PrizeClaimResponse | null;
  onClaim: () => void;
  isClaiming: boolean;
  error: string | null;
  firstName?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export const WinnerCelebrationModal: React.FC<WinnerCelebrationModalProps> = ({
  visible,
  onClose,
  rank,
  hasClaimed,
  claimData,
  onClaim,
  isClaiming,
  error,
  firstName,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, 24);

  // Derive display status from claim data
  const statusLabel =
    claimData?.status === 'verified'
      ? 'Verified'
      : claimData?.status === 'delivered'
        ? 'Delivered'
        : 'Pending Verification';

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
        accessibilityLabel={t('leaderboard.a11yCloseCelebration')}
        accessibilityHint={t('leaderboard.a11yCloseCelebrationHint')}
      >
        <Pressable
          style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}
          accessibilityRole='none'
          onPress={() => undefined}
        >
          <View style={styles.modalHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            {hasClaimed ? (
              /* ── Claimed state — ticket card ── */
              <>
                <View style={styles.iconWrapper}>
                  <Icon name='checkmark-circle' family='Ionicons' size={64} color={SUCCESS} />
                </View>

                <Text style={styles.heading}>{t('leaderboard.prizeClaimed')}</Text>

                <View style={styles.ticketCard}>
                  <Text style={styles.ticketPrize}>Smartphone</Text>
                  {firstName != null && <Text style={styles.ticketName}>{firstName}</Text>}
                  <Text style={styles.ticketRank}>Rank #{rank}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                  </View>
                </View>

                <Text style={styles.body}>{t('leaderboard.teamWillCallPeriod')}</Text>
              </>
            ) : (
              /* ── Initial / Claiming / Error state ── */
              <>
                <Text style={styles.trophyEmoji}>{'\u{1F3C6}'}</Text>

                <Text style={styles.heading}>Congratulations!</Text>

                <Text style={styles.subtext}>You finished #{rank} in the challenge!</Text>

                <Text style={styles.prizeText}>You've won a Smartphone!</Text>

                {error != null && (
                  <View style={styles.errorBanner}>
                    <Icon name='alert-circle-outline' family='Ionicons' size={18} color={ERROR} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Text style={styles.note}>{t('leaderboard.teamWillCall')}</Text>
              </>
            )}
          </ScrollView>

          {/* ── Fixed bottom button ── */}
          {hasClaimed ? (
            <Pressable
              style={styles.modalBtn}
              onPress={onClose}
              accessibilityRole='button'
              accessibilityLabel={t('leaderboard.gotIt')}
              accessibilityHint={t('leaderboard.a11yDismissCelebration')}
            >
              <Text style={styles.modalBtnTxt}>{t('leaderboard.gotIt')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.modalBtn, isClaiming && styles.modalBtnDisabled]}
              onPress={onClaim}
              disabled={isClaiming}
              accessibilityRole='button'
              accessibilityLabel={t('leaderboard.a11yClaimPrize')}
              accessibilityHint={t('leaderboard.a11yClaimPrizeHint')}
            >
              {isClaiming ? (
                <ActivityIndicator size='small' color={INVERSE_TEXT} />
              ) : (
                <Text style={styles.modalBtnTxt}>{t('leaderboard.claimYourPrize')}</Text>
              )}
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Modal shell (matches PrizeModal exactly) ──
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
  modalScrollContent: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // ── Trophy / icon area ──
  trophyEmoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    marginBottom: 12,
    alignItems: 'center',
  },

  // ── Typography ──
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  prizeText: {
    fontSize: 18,
    fontWeight: '700',
    color: GOLD_TEXT,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  note: {
    fontSize: 13,
    color: TEXT_TERTIARY,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
  },

  // ── Ticket card (claimed state) ──
  ticketCard: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BORDER,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  ticketPrize: {
    fontSize: 22,
    fontWeight: '800',
    color: GOLD_TEXT,
    textAlign: 'center',
    marginBottom: 8,
  },
  ticketName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 4,
  },
  ticketRank: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 12,
  },

  // ── Status badge ──
  statusBadge: {
    backgroundColor: AMBER_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER_TEXT,
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
    alignSelf: 'stretch',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: ERROR,
    lineHeight: 18,
  },

  // ── Button (matches PrizeModal modalBtn) ──
  modalBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: INVERSE_TEXT,
  },
});
