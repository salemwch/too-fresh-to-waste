/**
 * PrizeTierCards — the two prize tiers, with the user's own tier highlighted.
 *
 * Memoised and driven by a single `userTier` prop: it sat inside the header's
 * useMemo alongside the countdown, so it was rebuilt once a second for no
 * reason. It only changes when the user's rank crosses the prize cutoff.
 *
 * The grand-prize card names the elected prize once the community's vote has
 * decided, and falls back to "Community's choice" while it has not. That is the
 * whole point of the card: it must never name a prize the vote has not chosen,
 * because the user plans around what it says.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  BG_GOLD_CARD,
  BG_MINT_CARD,
  BORDER_MINT,
  CHAMPION_GOLD,
  DISCOUNT_INK,
  GOLD_15,
  GOLD_45,
  GOLD_INK,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../constants/palette';
import { DEFAULT_PRIZE_RANKS, firstDiscountRank } from '../../utils/prizeTiers';

import type { GrandPrizePresentation } from '../../utils/prizePresentation';
import type { RowTier } from '../../utils/prizeTiers';
import { colorTokens, withAlpha } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp, radius } = spacingTokens;

const MINT_ICON_BG = withAlpha(colorTokens.base.success[500], 0.12);

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    gap: sp[3],
    paddingHorizontal: sp[5],
    marginBottom: sp.sm,
  },
  card: {
    flex: 1,
    /*
     * The top padding is not decorative. The "your tier" badge is a corner tab
     * pinned to top:0, and at the previous 16px padding the title row began
     * inside the tab's own box — the badge sat over the second word of
     * "Community's Choice". 24px clears it, and both cards carry it so they
     * stay aligned even though only one shows a badge.
     */
    paddingTop: sp.lg,
    paddingHorizontal: sp.md,
    paddingBottom: sp.md,
    borderRadius: radius.xl,
    minHeight: 128,
    borderWidth: 1,
  },
  cardGrand: { backgroundColor: BG_GOLD_CARD, borderColor: GOLD_45 },
  cardDiscount: { backgroundColor: BG_MINT_CARD, borderColor: BORDER_MINT },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGrand: { backgroundColor: GOLD_15 },
  iconCircleDiscount: { backgroundColor: MINT_ICON_BG },
  icon: { fontSize: 20 },
  name: { flex: 1, fontSize: 14, lineHeight: 17, fontWeight: '800', color: TEXT_PRIMARY },
  tier: { fontSize: 12, color: TEXT_MUTED, marginTop: sp.sm, fontWeight: '600' },
  footer: { marginTop: 'auto', paddingTop: sp[3], fontSize: 12, fontWeight: '700' },
  footerGrand: { color: GOLD_INK },
  footerDiscount: { color: DISCOUNT_INK },
  youBadge: {
    position: 'absolute',
    top: 0,
    insetInlineEnd: 0,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    color: SURFACE,
    backgroundColor: CHAMPION_GOLD,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
    borderStartEndRadius: radius.xl,
    borderEndStartRadius: radius.lg,
    overflow: 'hidden',
  },
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
  /** Already-resolved footer line. */
  footer: string;
  /** Whether this is the tier the current user is on track for. */
  isYours: boolean;
  variant: 'grand' | 'discount';
}

const TierCard: React.FC<TierCardProps> = ({
  icon,
  name,
  tierLabelKey,
  tierLabelRank,
  footer,
  isYours,
  variant,
}) => {
  const { t } = useTranslation();
  const isGrand = variant === 'grand';

  return (
    <View style={[styles.card, isGrand ? styles.cardGrand : styles.cardDiscount]}>
      {isYours && <Text style={styles.youBadge}>{t('leaderboard.yourTierBadge')}</Text>}

      <View style={styles.top}>
        <View
          style={[styles.iconCircle, isGrand ? styles.iconCircleGrand : styles.iconCircleDiscount]}
        >
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      </View>

      <Text style={styles.tier}>
        {t(tierLabelKey, { count: tierLabelRank, rank: tierLabelRank })}
      </Text>

      <Text style={[styles.footer, isGrand ? styles.footerGrand : styles.footerDiscount]}>
        {footer}
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
  const isDecided = grandPrize.name != null;

  return (
    <View style={styles.block}>
      <TierCard
        variant='grand'
        icon={grandPrize.icon}
        name={grandPrize.name ?? t('leaderboard.prizeVotedByCommunity')}
        tierLabelKey='leaderboard.tierTopWinners'
        tierLabelRank={prizeRanks}
        // Once the vote has decided, the card states the result; while it is
        // open it asks for a vote. Saying "chosen by the community" before a
        // choice exists would be a lie the user acts on.
        footer={t(
          isDecided ? 'leaderboard.prizeChosenByCommunity' : 'leaderboard.voteForFavorites',
        )}
        isYours={userTier === 'grandPrize'}
      />
      <TierCard
        variant='discount'
        icon='🎁'
        name={t('leaderboard.prizeDiscount')}
        tierLabelKey='leaderboard.tierBelowPrize'
        tierLabelRank={firstDiscountRank(prizeRanks)}
        footer={t('leaderboard.keepClimbing')}
        isYours={userTier === 'discount'}
      />
    </View>
  );
};

export const PrizeTierCards = memo(PrizeTierCardsComponent);
PrizeTierCards.displayName = 'PrizeTierCards';
