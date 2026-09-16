/**
 * The two hero banners as one swipeable row.
 *
 * WHY A CAROUSEL AND NOT A STACK
 * ------------------------------
 * Stacked, the two banners cost ~200dp of vertical space before the first deal
 * is visible. On a 360dp phone that pushed Urgent Deals below the fold - the
 * banners were winning space from the content people actually came for.
 *
 * WHY NOT SIDE BY SIDE
 * --------------------
 * Halving the width leaves no room for what these cards carry. The impact card
 * has an amount, a suffix and a two-part sub-line; the prize card has a count
 * and a progress bar. At 50% the amount wraps onto two lines at a reduced size,
 * which is the one number the card exists to show.
 *
 * WHY THE PEEK MATTERS
 * --------------------
 * Material 3 calls this the uncontained carousel: the trailing card is
 * deliberately cut off by the screen edge, and that cut IS the affordance. A
 * card at full width reads as a static banner and does not get swiped. Width
 * comes from `carouselWidth.ts` so the peek holds on every screen size rather
 * than only the one it was tuned on.
 *
 * ORDER IS NOT ARBITRARY
 * ----------------------
 * Impact first. The overwhelming majority of carousel interaction lands on the
 * first item, so the card that carries the brand promise goes there and the
 * prize draw - which is promotional - takes second.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { spacingTokens } from '@/design-system/tokens/spacing';
import { ImpactBanner } from '@/features/donations/components/ImpactBanner';

import { HERO_CARD_RATIO, getCarouselWidth } from '../utils/carouselWidth';
import { MonthlyBagGoalBanner } from './MonthlyBagGoalBanner';

import type { ListRenderItemInfo } from 'react-native';

const { base: sp } = spacingTokens;

/** Identifies which banner a row is, so `renderItem` stays a pure switch. */
type HeroId = 'impact' | 'prize';

const HERO_ORDER: readonly HeroId[] = ['impact', 'prize'];

interface HomeHeroCarouselProps {
  /** Opens the charity/impact detail. */
  onImpactPress: () => void;
  /** Opens the leaderboard / prize detail. */
  onPrizePress: () => void;
}

const HomeHeroCarouselComponent = ({
  onImpactPress,
  onPrizePress,
}: HomeHeroCarouselProps): React.ReactElement => {
  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth, snapInterval } = getCarouselWidth({
    screenWidth,
    ratio: HERO_CARD_RATIO,
    gap: sp[3],
  });

  /*
   * Memoised: both are compared by identity, so a fresh object each render
   * re-lays-out the row. See `.claude/rules/performance.md`.
   */
  const cardStyle = useMemo(() => ({ width: cardWidth, marginEnd: sp[3] }), [cardWidth]);
  const contentStyle = useMemo(
    // sp.md, not sp[4]: the scale has no numeric 4. Matches the 16dp page gutter.
    () => ({ paddingHorizontal: sp.md }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<HeroId>) => (
      <View style={cardStyle}>
        {item === 'impact' ? (
          <ImpactBanner onExpand={onImpactPress} />
        ) : (
          <MonthlyBagGoalBanner onPress={onPrizePress} />
        )}
      </View>
    ),
    [cardStyle, onImpactPress, onPrizePress],
  );

  return (
    <FlatList
      data={HERO_ORDER}
      renderItem={renderItem}
      keyExtractor={id => id}
      horizontal
      showsHorizontalScrollIndicator={false}
      /*
       * `snapToInterval` must equal the rendered card width plus its gap, which
       * is why both come from getCarouselWidth rather than being written out
       * here. A mismatch compounds: the first card snaps correctly and later
       * ones drift progressively off-centre.
       */
      snapToInterval={snapInterval}
      snapToAlignment='start'
      decelerationRate='fast'
      contentContainerStyle={contentStyle}
      style={styles.list}
      // Two items: virtualisation costs more than it saves, and windowing can
      // blank a card mid-swipe.
      initialNumToRender={HERO_ORDER.length}
      accessibilityRole='list'
      testID='home-hero-carousel'
    />
  );
};

HomeHeroCarouselComponent.displayName = 'HomeHeroCarousel';

export const HomeHeroCarousel = memo(HomeHeroCarouselComponent);

const styles = StyleSheet.create({
  list: {
    // The banners carry their own vertical padding; this only spaces the row
    // from the category rail above and the first section below.
    marginBottom: sp.sm,
  },
});
