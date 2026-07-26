/**
 * ChallengeCountdown — days:hours:mins:secs until the challenge ends.
 *
 * Owns its own ticking state rather than taking a `countdown` prop.
 *
 * This is the point of the component. The tick fires once a second, and while
 * the value lived on LeaderboardScreen it sat in the ListHeader useMemo's
 * dependency array — so every second the whole header subtree was rebuilt:
 * both prize cards, the section header, and PodiumTop5 with its five FastImage
 * avatars. Keeping the state here means a tick re-renders four <Text> nodes and
 * nothing else.
 *
 * Renders null once the challenge has ended — the screen shows a different
 * state then, so a row of zeros would be wrong.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CHAMPION_GOLD, TEXT_30 } from '../../constants/palette';
import { getCountdown } from '../../utils/countdown';

const TICK_MS = 1000;

const CD_SEGMENT_BG = 'rgba(0,0,0,0.4)';
const CD_SEGMENT_BORDER = 'rgba(196,162,90,0.12)';
const CD_COLON_COLOR = 'rgba(196,162,90,0.25)';

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
    backgroundColor: CD_SEGMENT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CD_SEGMENT_BORDER,
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
    color: CD_COLON_COLOR,
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
      <Segment value={countdown.days} label='DAYS' />
      <Text style={styles.colon}>:</Text>
      <Segment value={countdown.hours} label='HOURS' />
      <Text style={styles.colon}>:</Text>
      <Segment value={countdown.mins} label='MINS' />
      <Text style={styles.colon}>:</Text>
      <Segment value={countdown.secs} label='SECS' />
    </View>
  );
};
