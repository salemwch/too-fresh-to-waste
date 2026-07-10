/**
 * FloatingVoteTab
 * A floating tab on the left edge of the HomeScreen, vertically centered.
 * - First tap: expands rightward
 * - Tap expanded area: navigate to Loyalty immediately (no collapse animation)
 * - Tap ✕ or backdrop: animated collapse
 * - Screen blur (navigating away): instant reset to collapsed
 */

import React, { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';

import { Text } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { navigationRef } from '@/navigation/navigationRef';

import { useActiveVotingCycle } from '../hooks/useVoting';

const PRIMARY_500 = colorTokens.base.primary[500];
const COLLAPSED_WIDTH = 35;
const EXPANDED_WIDTH = 150;
const TAB_HEIGHT = 56;

interface FloatingVoteTabProps {
  /** Force the tab visible regardless of voting state — dev/testing only. */
  forceVisible?: boolean;
}

export const FloatingVoteTab: React.FC<FloatingVoteTabProps> = ({ forceVisible }) => {
  const { cycle, eligibility, myVote, isLoading } = useActiveVotingCycle();
  const [expanded, setExpanded] = useState(false);

  const widthAnim = useRef(new Animated.Value(COLLAPSED_WIDTH)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const isVisible =
    forceVisible === true ||
    (!isLoading && cycle?.status === 'BALLOT_OPEN' && eligibility?.canVote === true && !myVote);

  // Instantly reset to collapsed — used on navigation and screen blur
  const resetCollapsed = useCallback(() => {
    widthAnim.setValue(COLLAPSED_WIDTH);
    textOpacity.setValue(0);
    setExpanded(false);
  }, [widthAnim, textOpacity]);

  // Animated collapse — used for ✕ button and backdrop tap
  const collapse = useCallback(() => {
    Animated.parallel([
      Animated.timing(widthAnim, {
        toValue: COLLAPSED_WIDTH,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => setExpanded(false));
  }, [widthAnim, textOpacity]);

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

  // Reset to collapsed instantly when HomeScreen loses focus (e.g. user navigates away)
  useFocusEffect(
    useCallback(() => {
      return () => resetCollapsed();
    }, [resetCollapsed]),
  );

  const handlePillPress = useCallback(() => {
    if (!expanded) {
      expand();
    } else {
      // Navigate immediately — no collapse animation so text stays visible during transition
      resetCollapsed();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigationRef.dispatch(CommonActions.navigate({ name: 'Loyalty' }) as any);
    }
  }, [expanded, expand, resetCollapsed]);

  if (!isVisible) return null;

  return (
    <>
      {expanded && <Pressable style={styles.backdrop} onPress={collapse} accessible={false} />}

      <View style={styles.overlay} pointerEvents='box-none'>
        <Pressable
          onPress={handlePillPress}
          accessibilityRole='button'
          accessibilityLabel='Voting is live — tap to vote'
          accessibilityHint='Opens the voting screen where you can cast your vote'
        >
          <Animated.View style={[styles.tab, { width: widthAnim }]}>
            <Text style={styles.trophy}>🏆</Text>

            {expanded && (
              <Animated.View style={[styles.expandedContent, { opacity: textOpacity }]}>
                <Text variant='body' size='sm' weight='bold' style={styles.label}>
                  {'Voting Is Live!\nVote Now'}
                </Text>

                <Pressable
                  onPress={collapse}
                  style={styles.closeBtn}
                  accessibilityRole='button'
                  accessibilityLabel='Close'
                  accessibilityHint='Collapses the voting tab'
                  hitSlop={8}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
};

FloatingVoteTab.displayName = 'FloatingVoteTab';

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 100,
  },
  tab: {
    height: TAB_HEIGHT,
    backgroundColor: PRIMARY_500,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
    paddingRight: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  trophy: {
    fontSize: 20,
  },
  expandedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    lineHeight: 16,
  },
  closeBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
});
