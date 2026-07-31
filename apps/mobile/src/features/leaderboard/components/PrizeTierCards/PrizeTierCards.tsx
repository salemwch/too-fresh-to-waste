/**
 * PrizeTierCards — the two prize tiers, with the user's own tier highlighted.
 *
 * Memoised and driven by a single `userTier` prop: it sat inside the header's
 * useMemo alongside the countdown, so it was rebuilt once a second for no
 * reason. It only changes when the user's rank crosses the prize cutoff.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import {
  BG_CARD,
  BORDER_CARD,
  BORDER_GOLD,
  CHAMPION_GOLD,
  GOLD_04,
  GOLD_10,
  TEXT_30,
  TEXT_WHITE,
} from '../../constants/palette';
import { DEFAULT_PRIZE_RANKS, firstDiscountRank } from '../../utils/prizeTiers';

import type { GrandPrizePresentation } from '../../utils/prizePresentation';
import type { RowTier } from '../../utils/prizeTiers';

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  card: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_CARD,
  },
  cardWinning: {
    borderColor: BORDER_GOLD,
    backgroundColor: GOLD_04,
    ...Platform.select({
      ios: {
        shadowColor: CHAMPION_GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  youBadge: {
    position: 'absolute',
    top: 6,
    insetInlineEnd: 8,
    fontSize: 8,
    fontWeight: '700',
    color: CHAMPION_GOLD,
    backgroundColor: GOLD_10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  icon: { fontSize: 24, marginBottom: 6 },
  name: { fontSize: 12, fontWeight: '700', color: TEXT_WHITE },
  nameGold: { color: CHAMPION_GOLD },
  tier: { fontSize: 9, color: TEXT_30, marginTop: 3, fontWeight: '600' },
});

interface TierCardProps {
  icon: string;
  /**
   * Already-resolved label. The grand prize card shows a name the admin typed,
   * which no translation file can know; the discount card passes a translated
   * string. Keeping this a plain string lets both share one component.
   */
  name: string;
  tierLabelKey: string;
  /**
   * Interpolated into `tierLabelKey`. A primitive rather than a values object
   * so the prop identity stays stable across renders.
   */
  tierLabelRank: number;
  /** Whether this is the tier the current user is on track for. */
  isYours: boolean;
}

const TierCard: React.FC<TierCardProps> = ({
  icon,
  name,
  tierLabelKey,
  tierLabelRank,
  isYours,
}) => {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, isYours && styles.cardWinning]}>
      {isYours && <Text style={styles.youBadge}>{t('leaderboard.yourTierBadge')}</Text>}
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.name, isYours && styles.nameGold]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.tier}>
        {t(tierLabelKey, { count: tierLabelRank, rank: tierLabelRank })}
      </Text>
    </View>
  );
};

export interface PrizeTierCardsProps {
  /** Which tier the current user currently qualifies for. */
  userTier: RowTier;
  /** How many top ranks win the grand prize this season. */
  prizeRanks?: number;
  /**
   * The prize this season elected. Undecided seasons pass `name: null` and get
   * the generic label — the card must never name a prize the vote has not
   * chosen, because the user plans around what it says.
   */
  grandPrize?: GrandPrizePresentation;
}

const UNDECIDED_PRIZE: GrandPrizePresentation = { icon: '🏆', name: null };

const PrizeTierCardsComponent: React.FC<PrizeTierCardsProps> = ({
  userTier,
  prizeRanks = DEFAULT_PRIZE_RANKS,
  grandPrize = UNDECIDED_PRIZE,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.block}>
      <TierCard
        icon={grandPrize.icon}
        name={grandPrize.name ?? t('leaderboard.prizeVotedByCommunity')}
        tierLabelKey='leaderboard.tierTopWinners'
        tierLabelRank={prizeRanks}
        isYours={userTier === 'grandPrize'}
      />
      <TierCard
        icon='🎁'
        name={t('leaderboard.prizeDiscount')}
        tierLabelKey='leaderboard.tierBelowPrize'
        tierLabelRank={firstDiscountRank(prizeRanks)}
        isYours={userTier === 'discount'}
      />
    </View>
  );
};

export const PrizeTierCards = memo(PrizeTierCardsComponent);
PrizeTierCards.displayName = 'PrizeTierCards';
