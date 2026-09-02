import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { colorTokens } from '@/design-system/tokens/colors';

import { FavoriteOfferCard } from './FavoriteOfferCard';
import { DeletedOfferCard } from './DeletedOfferCard';

import type { OfferListItem, Offer } from '@/features/offers/types';

const { base: sp } = spacingTokens;

const CARD_WIDTH = 280;

export interface FavoriteGroupItem {
  favoriteId: string;
  offer: OfferListItem | null;
  isDeleted: boolean;
}

export interface FavoriteEstablishmentGroupData {
  establishmentName: string;
  items: FavoriteGroupItem[];
}

interface FavoriteEstablishmentRowProps {
  group: FavoriteEstablishmentGroupData;
  onOfferPress: (offer: Offer | OfferListItem) => void;
  onRemoveDeleted: (favoriteId: string) => void;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: sp.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  name: {
    flex: 1,
    marginEnd: 8,
  },
  carousel: {
    paddingStart: 16,
    paddingEnd: 8,
    paddingVertical: 4,
  },
  offerCard: {
    width: CARD_WIDTH,
    maxWidth: CARD_WIDTH,
    marginEnd: sp[3],
  },
  deletedCard: {
    width: CARD_WIDTH,
    marginEnd: sp[3],
  },
  countText: {
    color: colorTokens.base.neutral[700],
  },
});

export const FavoriteEstablishmentRow = React.memo(
  ({ group, onOfferPress, onRemoveDeleted }: FavoriteEstablishmentRowProps) => {
    const offerCount = group.items.filter(i => !i.isDeleted).length;

    const renderItem = useCallback(
      ({ item }: { item: FavoriteGroupItem }) => {
        if (item.isDeleted || item.offer === null) {
          return (
            <DeletedOfferCard
              onRemove={() => onRemoveDeleted(item.favoriteId)}
              style={styles.deletedCard}
            />
          );
        }

        return (
          <FavoriteOfferCard
            offer={item.offer}
            variant='default'
            imageAspectRatio={1.8}
            onPress={onOfferPress}
            testID={`favorite-offer-${item.offer.id}`}
            style={styles.offerCard}
          />
        );
      },
      [onOfferPress, onRemoveDeleted],
    );

    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Text variant='title' size='md' weight='semibold' numberOfLines={1} style={styles.name}>
            {group.establishmentName}
          </Text>
          <Text variant='body' size='sm' style={styles.countText}>
            {offerCount} {offerCount === 1 ? 'offer' : 'offers'}
          </Text>
        </View>
        <FlatList
          data={group.items}
          renderItem={renderItem}
          keyExtractor={item => item.favoriteId}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          snapToInterval={CARD_WIDTH + sp[3]}
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
FavoriteEstablishmentRow.displayName = 'FavoriteEstablishmentRow';
