/**
 * EstablishmentOfferRow
 *
 * One section per business in the search list view: the establishment name, an
 * offer count, and a horizontal carousel of that establishment's offers.
 *
 * Memoised because the list re-renders on every map region change while the
 * groups themselves rarely change. `onOfferPress` must therefore be stable at
 * the call site or the memo is defeated.
 */

import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { FavoriteOfferCard } from '@/features/favorites';

import { nearbyOfferToListItem } from '../../utils/offerMappers';

import type { EstablishmentGroup } from '../../utils/groupOffers';
import type { NearbyOffer, ProximitySearchResult } from '@/features/offers/hooks';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

const CARD_WIDTH = 260;

const styles = StyleSheet.create({
  section: {
    marginBottom: 8,
    paddingBottom: sp[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    flex: 1,
    marginEnd: 8,
  },
  carousel: {
    paddingEnd: 8,
    paddingVertical: 4,
  },
  offerCard: {
    width: CARD_WIDTH,
    marginEnd: sp[3],
  },
});

export interface EstablishmentOfferRowProps {
  group: EstablishmentGroup;
  onOfferPress: (offer: ProximitySearchResult<NearbyOffer>) => void;
}

export const EstablishmentOfferRow = React.memo(
  ({ group, onOfferPress }: EstablishmentOfferRowProps) => {
    const renderOffer = useCallback(
      ({ item }: { item: ProximitySearchResult<NearbyOffer> }) => (
        <FavoriteOfferCard
          offer={nearbyOfferToListItem(item)}
          variant='default'
          imageAspectRatio={1.8}
          onPress={() => onOfferPress(item)}
          testID={`search-offer-${item.item._id}`}
          style={styles.offerCard}
        />
      ),
      [onOfferPress],
    );

    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Text variant='title' size='md' weight='semibold' numberOfLines={1} style={styles.name}>
            {group.establishmentName}
          </Text>
          <Text variant='body' size='sm' color='secondary'>
            {group.offers.length} {group.offers.length === 1 ? 'offer' : 'offers'}
          </Text>
        </View>
        <FlatList
          data={group.offers}
          renderItem={renderOffer}
          keyExtractor={item => item.item._id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          snapToInterval={CARD_WIDTH}
          decelerationRate='fast'
          windowSize={2}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          removeClippedSubviews
        />
      </View>
    );
  },
);
EstablishmentOfferRow.displayName = 'EstablishmentOfferRow';
