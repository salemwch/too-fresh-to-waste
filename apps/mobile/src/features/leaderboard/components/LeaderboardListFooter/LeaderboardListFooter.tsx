/**
 * LeaderboardListFooter — pagination control plus the optional neighbourhood
 * section, rendered below the ranked list.
 *
 * Returns null when there is nothing to show, so the list gets no footer at all
 * rather than an empty wrapper.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/design-system/components/atoms';

import { NeighborhoodSection } from '../NeighborhoodSection';

import { CHAMPION_GOLD, GOLD_06, GOLD_15 } from '../../constants/palette';

import type { LeaderboardNeighborhoodEntry } from '../../types/leaderboard.types';

const styles = StyleSheet.create({
  loadMoreSpinner: { alignItems: 'center', paddingVertical: 16 },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
    backgroundColor: GOLD_06,
    borderWidth: 1,
    borderColor: GOLD_15,
  },
  viewMoreTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMPION_GOLD,
  },
});

export interface LeaderboardListFooterProps {
  /** A further page is in flight. */
  isFetchingNextPage: boolean;
  /** There are more pages to request. */
  hasNextPage: boolean;
  onViewMore: () => void;
  /** Whether the neighbourhood section is expanded. */
  showNeighborhood: boolean;
  neighborhoodEntries: LeaderboardNeighborhoodEntry[];
  neighborhoodLoading: boolean;
}

const LeaderboardListFooterComponent: React.FC<LeaderboardListFooterProps> = ({
  isFetchingNextPage,
  hasNextPage,
  onViewMore,
  showNeighborhood,
  neighborhoodEntries,
  neighborhoodLoading,
}) => {
  const { t } = useTranslation();

  // While a page is loading the spinner replaces the button, so the user cannot
  // queue a second request for the same page.
  const showSpinner = isFetchingNextPage;
  const showViewMore = !isFetchingNextPage && hasNextPage;

  if (!showSpinner && !showViewMore && !showNeighborhood) return null;

  return (
    <>
      {showSpinner && (
        <View style={styles.loadMoreSpinner}>
          <ActivityIndicator size='small' color={CHAMPION_GOLD} />
        </View>
      )}

      {showViewMore && (
        <Pressable style={styles.viewMoreBtn} onPress={onViewMore} accessibilityRole='button'>
          <Text style={styles.viewMoreTxt}>{t('leaderboard.viewMore')}</Text>
          <Icon name='chevron-down-outline' family='Ionicons' size={16} color={CHAMPION_GOLD} />
        </Pressable>
      )}

      {showNeighborhood && (
        <NeighborhoodSection entries={neighborhoodEntries} isLoading={neighborhoodLoading} />
      )}
    </>
  );
};

export const LeaderboardListFooter = memo(LeaderboardListFooterComponent);
LeaderboardListFooter.displayName = 'LeaderboardListFooter';
