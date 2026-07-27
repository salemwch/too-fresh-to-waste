/**
 * PrizeInfoModal — explains how the grand prize works.
 *
 * Keeps a light surface deliberately, unlike the rest of the leaderboard: this
 * is a wall of explanatory text and reads better on white.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BG_DARK,
  BORDER_SUBTLE,
  DISCOUNT_TINT,
  HANDLE_GREY,
  OVERLAY,
  PRIMARY,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  TEXT_WHITE,
} from '../../constants/palette';
import { DEFAULT_PRIZE_RANKS, firstDiscountRank } from '../../utils/prizeTiers';

/** Minimum bottom padding when the device has no home indicator. */
const MIN_BOTTOM_PAD = 24;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '85%',
  },
  scrollContent: { paddingBottom: 16 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: HANDLE_GREY,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    marginTop: 6,
  },
  goalTxt: { flex: 1, fontSize: 14, color: TEXT_SECONDARY, lineHeight: 20 },
  goalBold: { fontWeight: '700', color: TEXT_PRIMARY },
  divider: {
    height: 1,
    backgroundColor: BORDER_SUBTLE,
    marginVertical: 16,
  },
  tier: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  tierIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierIconPhone: { backgroundColor: `${PRIMARY}12` },
  tierIconDiscount: { backgroundColor: DISCOUNT_TINT },
  tierEmoji: { fontSize: 22 },
  tierInfo: { flex: 1 },
  tierTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 2 },
  tierRank: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginBottom: 4 },
  tierDesc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 19 },
  note: { fontSize: 13, color: TEXT_TERTIARY, lineHeight: 19, marginBottom: 12 },
  btn: {
    backgroundColor: BG_DARK,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnTxt: { fontSize: 15, fontWeight: '700', color: TEXT_WHITE },
});

export interface PrizeInfoModalProps {
  visible: boolean;
  onClose: () => void;
  /** Days until prizes unlock; null or 0 means the drop is already live. */
  daysLeft: number | null;
  /** How many top ranks win the grand prize this season. */
  prizeRanks?: number;
}

export const PrizeInfoModal: React.FC<PrizeInfoModalProps> = ({
  visible,
  onClose,
  daysLeft,
  prizeRanks = DEFAULT_PRIZE_RANKS,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, MIN_BOTTOM_PAD);

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Outer press dismisses; the inner one swallows presses on the sheet. */}
      <Pressable style={styles.overlay} onPress={onClose} accessible={false}>
        <Pressable
          accessible={false}
          style={[styles.sheet, { paddingBottom: sheetBottomPad }]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title}>{t('leaderboard.howGrandPrizeWorks')}</Text>

            <View style={styles.goalRow}>
              <View style={styles.goalDot} />
              <Text style={styles.goalTxt}>
                {daysLeft != null && daysLeft > 0 ? (
                  <Text style={styles.goalBold}>
                    {t('leaderboard.prizesUnlockIn', { count: daysLeft })}
                  </Text>
                ) : (
                  <Text style={styles.goalBold}>{t('leaderboard.prizeDropLive')}</Text>
                )}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.tier}>
              <View style={[styles.tierIcon, styles.tierIconPhone]}>
                <Text style={styles.tierEmoji}>📱</Text>
              </View>
              <View style={styles.tierInfo}>
                <Text style={styles.tierTitle}>{t('leaderboard.prizeSmartphone')}</Text>
                <Text style={styles.tierRank}>
                  {t('leaderboard.prizeSmartphoneRank', { count: prizeRanks })}
                </Text>
                <Text style={styles.tierDesc}>
                  {t('leaderboard.prizeSmartphoneDesc', { count: prizeRanks })}
                </Text>
              </View>
            </View>

            <View style={styles.tier}>
              <View style={[styles.tierIcon, styles.tierIconDiscount]}>
                <Text style={styles.tierEmoji}>🎁</Text>
              </View>
              <View style={styles.tierInfo}>
                <Text style={styles.tierTitle}>{t('leaderboard.prizeDiscount')}</Text>
                <Text style={styles.tierRank}>
                  {t('leaderboard.prizeDiscountRank', { rank: firstDiscountRank(prizeRanks) })}
                </Text>
                <Text style={styles.tierDesc}>{t('leaderboard.prizeDiscountDesc')}</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.note}>{t('leaderboard.rankingNote')}</Text>
          </ScrollView>

          <Pressable style={styles.btn} onPress={onClose} accessibilityRole='button'>
            <Text style={styles.btnTxt}>{t('leaderboard.gotItExclaim')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
