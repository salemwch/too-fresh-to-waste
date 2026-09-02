/**
 * ChallengeCountdown — days:hours:mins:secs until the challenge ends.
 *
 * Owns its own ticking state rather than taking a `countdown` prop.
 *
 * This is the point of the component. The tick fires once a second, and while
 * the value lived on LeaderboardScreen it sat in the ListHeader useMemo's
 * dependency array — so every second the whole header subtree was rebuilt:
 * both prize cards, the section header, and the podium with its FastImage
 * avatars. Keeping the state here means a tick re-renders four <Text> nodes and
 * nothing else.
 *
 * Renders null once the challenge has ended — the screen shows a different
 * state then, so a row of zeros would be wrong.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  CHAMPION_GOLD,
  COUNTDOWN_SEGMENT_BG,
  COUNTDOWN_SEGMENT_BORDER,
  COUNTDOWN_SEPARATOR,
  TEXT_30,
} from '../../constants/palette';
import { getCountdown } from '../../utils/countdown';

const TICK_MS = 1000;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: COUNTDOWN_SEGMENT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COUNTDOWN_SEGMENT_BORDER,
  },
  num: {
    fontSize: 24,
    fontWeight: '800',
    color: CHAMPION_GOLD,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 8,
    color: TEXT_30,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  colon: {
    fontSize: 20,
    color: COUNTDOWN_SEPARATOR,
    fontWeight: '800',
    paddingBottom: 10,
  },
});

export interface ChallengeCountdownProps {
  endDate: string | undefined;
}

const Segment: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <View style={styles.segment}>
    <Text style={styles.num}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

export const ChallengeCountdown: React.FC<ChallengeCountdownProps> = ({ endDate }) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(() => getCountdown(endDate));

  useEffect(() => {
    if (endDate == null) {
      setCountdown(null);
      return;
    }

    // Recompute immediately: a new endDate must not show the previous one's
    // value for up to a second.
    setCountdown(getCountdown(endDate));

    const interval = setInterval(() => setCountdown(getCountdown(endDate)), TICK_MS);
    return () => clearInterval(interval);
  }, [endDate]);

  if (countdown == null) return null;

  return (
    <View style={styles.row}>
      <Segment value={countdown.days} label={t('leaderboard.countdownDays')} />
      <Text style={styles.colon}>:</Text>
      <Segment value={countdown.hours} label={t('leaderboard.countdownHours')} />
      <Text style={styles.colon}>:</Text>
      <Segment value={countdown.mins} label={t('leaderboard.countdownMins')} />
      <Text style={styles.colon}>:</Text>
      <Segment value={countdown.secs} label={t('leaderboard.countdownSecs')} />
    </View>
  );
};
