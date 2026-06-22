/**
 * FloatingVoteTab
 * A floating pill at the top center of the HomeScreen that peeks down when voting
 * is live. Tap to expand into a horizontal banner; second tap navigates to
 * the Loyalty screen.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';

import { useActiveVotingCycle } from '../hooks/useVoting';

import type { HomeScreenNavigationProp } from '@/navigation/types';

const PRIMARY_500 = colorTokens.base.primary[500];
const COLLAPSED_WIDTH = 48;
const EXPANDED_WIDTH = 280;
const TAB_HEIGHT = 40;

interface FloatingVoteTabProps {
  navigation: HomeScreenNavigationProp;
}

export const FloatingVoteTab: React.FC<FloatingVoteTabProps> = ({ navigation }) => {
  const { cycle, eligibility, myVote, isLoading } = useActiveVotingCycle();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  // Animations
  const widthAnim = useRef(new Animated.Value(COLLAPSED_WIDTH)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const isVisible =
    !isLoading && cycle?.status === 'BALLOT_OPEN' && eligibility?.canVote === true && !myVote;

  const expand = useCallback(() => {
    setExpanded(true);
    Animated.parallel([
      Animated.timing(widthAnim, {
        toValue: EXPANDED_WIDTH,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 250,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [widthAnim, textOpacity]);

  const handlePress = useCallback(() => {
    if (!expanded) {
      expand();
    } else {
      navigation.navigate('Profile' as never);
    }
  }, [expanded, expand, navigation]);

  if (!isVisible) return null;

  return (
    <View style={[styles.overlay, { top: insets.top }]} pointerEvents='box-none'>
      <Pressable onPress={handlePress}>
        <Animated.View style={[styles.pill, { width: widthAnim }]}>
          <Text style={styles.trophy}>🏆</Text>
          {expanded && (
            <Animated.View style={[styles.expandedContent, { opacity: textOpacity }]}>
              <Text variant='body' size='sm' weight='bold' style={styles.pillText}>
                Voting Is Live! Vote Now
              </Text>
              <Text style={styles.arrow}>→</Text>
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
};

FloatingVoteTab.displayName = 'FloatingVoteTab';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    height: TAB_HEIGHT,
    backgroundColor: PRIMARY_500,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    shadowColor: PRIMARY_500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  trophy: {
    fontSize: 18,
  },
  expandedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: {
    color: '#FFFFFF',
  },
  arrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
});
