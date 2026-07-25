/**
 * Regression test: FlashList cells must re-render when async data arrives.
 *
 * HomeScreen renders its sections through a FlashList whose `data` array is a
 * stable, memoized list of section descriptors. The offers themselves are NOT
 * in `data` — they are captured by the `renderItem` closure.
 *
 * FlashList wraps every cell in a `PureComponentWrapper` and only re-renders a
 * cell when one of `data` / `arg` / `renderer` / `extendedState` changes
 * identity. `extendedState` is derived exclusively from the `extraData` prop.
 * With a stable `data` array and no `extraData`, cells are frozen at their
 * first render — so offers that arrive after mount are never painted.
 *
 * This reproduces that with the same shape HomeScreen uses.
 */

import { render, screen, act } from '@testing-library/react-native';
import React, { useMemo, useCallback, useState } from 'react';
import { Text } from 'react-native';

import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';

interface Section {
  id: string;
  type: 'urgentOffers';
}

/**
 * Mirrors HomeScreen: memoized sections (stable identity) + renderItem closing
 * over async-arriving offers. `setOffers` stands in for the TanStack query
 * resolving after mount.
 */
const HomeLike: React.FC<{ onReady: (setOffers: (o: string[]) => void) => void }> = ({
  onReady,
}) => {
  const [offers, setOffers] = useState<string[]>([]);

  // Same dependency shape as HomeScreen: sections only change when the
  // location prompt toggles, which never happens on a warm start.
  const sections = useMemo<Section[]>(() => [{ id: 'urgentOffers', type: 'urgentOffers' }], []);

  const renderSection = useCallback(
    ({ item }: ListRenderItemInfo<Section>) => (
      <Text testID={item.id}>
        {offers.length === 0 ? 'No urgent deals' : `${offers.length} offers`}
      </Text>
    ),
    [offers],
  );

  const keyExtractor = useCallback((item: Section) => item.id, []);

  onReady(setOffers);

  return (
    <FlashList<Section>
      data={sections}
      renderItem={renderSection}
      keyExtractor={keyExtractor}
      estimatedItemSize={200}
      // The fix under test: offers live in the renderItem closure, not in
      // `data`, so FlashList needs extraData to know the cells are dirty.
      extraData={renderSection}
      // Give the list a viewport; in the test env there is no native layout
      // pass, so without this FlashList renders zero cells.
      estimatedListSize={{ height: 800, width: 400 }}
    />
  );
};

describe('HomeScreen offer list re-render', () => {
  it('paints offers that arrive after the list has mounted', () => {
    let publishOffers: ((o: string[]) => void) | undefined;

    render(<HomeLike onReady={fn => (publishOffers = fn)} />);

    // Initial mount: query still loading, section shows the empty state.
    expect(screen.getByTestId('urgentOffers')).toHaveTextContent('No urgent deals');

    // The offers query resolves after mount — exactly what happens on a cold
    // start, where the cache is empty and the request is still in flight when
    // HomeScreen first renders.
    act(() => {
      publishOffers?.(['offer-1', 'offer-2', 'offer-3']);
    });

    expect(screen.getByTestId('urgentOffers')).toHaveTextContent('3 offers');
  });
});
