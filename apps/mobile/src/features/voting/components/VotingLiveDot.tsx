/**
 * VotingLiveDot
 * Pulsing 8px dot badge for the Profile tab icon.
 * Visible when any active voting cycle exists (ACTIVE or BALLOT_OPEN).
 */

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet } from 'react-native';

import { colorTokens } from '@/design-system/tokens/colors';

import { useActiveVotingCycle } from '../hooks/useVoting';

const PRIMARY_500 = colorTokens.base.primary[500];

export const VotingLiveDot: React.FC = () => {
  const { t } = useTranslation();
  const { cycle, isLoading } = useActiveVotingCycle();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const isLive =
    !isLoading && cycle !== null && (cycle.status === 'ACTIVE' || cycle.status === 'BALLOT_OPEN');

  useEffect(() => {
    if (!isLive) return;

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.4,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isLive, scaleAnim, opacityAnim]);

  if (!isLive) return null;

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
      accessibilityLabel={t('voting.a11yVotingActive')}
      accessibilityHint={t('common.a11yOpensDetailsHint')}
    />
  );
};

VotingLiveDot.displayName = 'VotingLiveDot';

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    insetInlineEnd: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY_500,
  },
});
