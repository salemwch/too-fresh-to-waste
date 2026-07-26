/**
 * ChallengeHeader — title, info button, live countdown and end date.
 *
 * The countdown ticks inside ChallengeCountdown rather than here, so a tick
 * re-renders only the four numbers, not this header or anything below it.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/design-system/components/atoms';

import { ChallengeCountdown } from '../ChallengeCountdown';

import { TEXT_25, TEXT_30, TEXT_40, TEXT_WHITE } from '../../constants/palette';

const INFO_BTN_BG = 'rgba(255,255,255,0.05)';

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_WHITE,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: TEXT_30,
    fontWeight: '500',
    marginTop: 3,
  },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INFO_BTN_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  onInfoPress: () => void;
}

const ChallengeHeaderComponent: React.FC<ChallengeHeaderProps> = ({ endDate, onInfoPress }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.block}>
      <View style={styles.top}>
        <View>
          <Text style={styles.title}>{t('leaderboard.grandPrize')}</Text>
          <Text style={styles.subtitle}>{t('leaderboard.communityMilestone')}</Text>
        </View>
        <Pressable
          style={styles.infoBtn}
          onPress={onInfoPress}
          accessibilityRole='button'
          accessibilityLabel={t('leaderboard.a11yShowPrizeInfo')}
          accessibilityHint={t('common.a11yOpensDetailsHint')}
        >
          <Icon name='information-circle-outline' family='Ionicons' size={22} color={TEXT_40} />
        </Pressable>
      </View>

      <ChallengeCountdown endDate={endDate} />

      {endDate != null && (
        <Text style={styles.endDate}>
          Ends{' '}
          <Text style={styles.endDateBold}>
            {new Date(endDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </Text>
      )}
    </View>
  );
};

export const ChallengeHeader = memo(ChallengeHeaderComponent);
ChallengeHeader.displayName = 'ChallengeHeader';
