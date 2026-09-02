/**
 * ChallengeHeader — the Grand Prize hero card.
 *
 * The countdown ticks inside ChallengeCountdown rather than here, so a tick
 * re-renders only the four numbers, not this header or anything below it.
 *
 * The countdown and end date sit INSIDE the card on purpose. The approved
 * redesign moved the screen to a cream ground, and the countdown's segments are
 * dark wells with gold numerals tuned against a dark surface — on cream they
 * would read as four black boxes. Keeping them on the hero's dark gradient
 * preserves both the design and the component, and it groups "what the prize is"
 * with "when it is decided", which belong together.
 *
 * The info button moved to the navigation header (see LeaderboardScreen's
 * headerRight): the trophy occupies the card's top-right corner, which is where
 * that button used to sit.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import trophyImg from '../../../../assets/images/prize-trophy.webp';

import { ChallengeCountdown } from '../ChallengeCountdown';

import {
  HERO_FROM,
  HERO_TO,
  MINT,
  PRIMARY,
  TEXT_25,
  TEXT_40,
  TEXT_85,
  TEXT_WHITE,
} from '../../constants/palette';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp, radius } = spacingTokens;

/**
 * Wide enough to set the body in three lines in English, narrow enough to clear
 * the trophy. French needs four lines at this width, which the card absorbs by
 * growing rather than by clipping.
 */
const BODY_WIDTH = 180;
const TROPHY_SIZE = 140;

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: sp[5],
    paddingTop: sp.md,
    paddingBottom: sp[3],
  },
  hero: {
    borderRadius: radius['3xl'],
    padding: sp[5],
    overflow: 'hidden',
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    color: TEXT_WHITE,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: MINT,
    marginTop: sp.xs,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
    color: TEXT_85,
    marginTop: 10,
    maxWidth: BODY_WIDTH,
  },
  trophy: {
    position: 'absolute',
    insetInlineEnd: -14,
    top: sp.sm,
    width: TROPHY_SIZE,
    height: TROPHY_SIZE,
  },
  countdown: { marginTop: sp.md },
  endDate: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 10,
    color: TEXT_25,
    fontWeight: '500',
  },
  endDateBold: { color: TEXT_40 },
});

export interface ChallengeHeaderProps {
  /** ISO end date; drives both the countdown and the "Ends …" line. */
  endDate: string | undefined;
}

const ChallengeHeaderComponent: React.FC<ChallengeHeaderProps> = ({ endDate }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.block}>
      <LinearGradient
        colors={[HERO_FROM, PRIMARY, HERO_TO]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.title}>{t('leaderboard.grandPrize')}</Text>
        <Text style={styles.subtitle}>{t('leaderboard.communityMilestone')}</Text>
        <Text style={styles.body}>{t('leaderboard.heroBody')}</Text>

        <Image
          source={trophyImg}
          style={styles.trophy}
          resizeMode='contain'
          accessibilityIgnoresInvertColors
          // Decorative: the heading beside it already names the prize, so a
          // screen reader announcing "trophy" would only repeat it.
          accessibilityElementsHidden
          importantForAccessibility='no'
        />

        <View style={styles.countdown}>
          <ChallengeCountdown endDate={endDate} />
        </View>

        {endDate != null && (
          <Text style={styles.endDate}>
            {t('leaderboard.endsOn', {
              // Device locale, not a hardcoded 'en-US': the rest of this screen
              // is translated, so an English date beside Arabic copy reads as a
              // bug.
              date: new Date(endDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
            })}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
};

export const ChallengeHeader = memo(ChallengeHeaderComponent);
ChallengeHeader.displayName = 'ChallengeHeader';
