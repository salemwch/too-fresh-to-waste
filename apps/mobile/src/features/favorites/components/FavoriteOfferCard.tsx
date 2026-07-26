/**
 * FavoriteOfferCard Component
 * OfferCard with integrated favorites functionality
 *
 * Features:
 * - Uses Redux state for instant UI updates
 * - Optimistic UI updates via useFavoriteToggle
 * - One-tap favorite toggle
 * - Race condition protection
 *
 * IMPORTANT: This component reads isFavorite from Redux (single source of truth)
 * for instant optimistic updates without waiting for API response.
 */

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { OfferCard } from '@/design-system/components/organisms';
import { selectIsFavorite } from '@/store/slices/favoritesSlice';

import { useFavoriteToggle } from '../hooks';

import type { OfferCardProps } from '@/design-system/components/organisms/OfferCard/OfferCard.types';
import type { RootState } from '@/store';

/**
 * OfferCard with favorites integration
 * Reads isFavorite from Redux for instant updates
 *
 * Memoized — for this wrapper's own cost, not the card's.
 *
 * OfferCard is `memo`-wrapped and `toggle` is useCallback'd, so the expensive
 * card render was already skipped when props compared equal. What was NOT
 * skipped was this component: as a plain function it re-ran on every parent
 * render, once per card in the list, each time re-executing useFavoriteToggle
 * and a useSelector and re-reconciling the element — work whose only outcome
 * was the inner memo deciding nothing had changed.
 *
 * On a Home screen with four carousels that is a few dozen wasted hook cycles
 * per parent render. Cheap individually, which is exactly why it went unnoticed.
 */
const FavoriteOfferCardComponent: React.FC<Omit<OfferCardProps, 'onFavorite'>> = props => {
  const { offer } = props;

  // Use optimistic toggle hook (reads from Redux after toggle, updates instantly)
  const { toggle } = useFavoriteToggle(offer.id, offer.title, offer.image);

  // ✅ Read from Redux (single source of truth) - updates instantly on toggle
  const isFavorite = useSelector((state: RootState) => selectIsFavorite(state, offer.id));
  const handleFavoritePress = useCallback(() => {
    void toggle();
  }, [toggle]);

  return (
    <OfferCard
      {...props}
      // ✅ Use Redux state for instant optimistic updates
      isFavorite={isFavorite}
      onFavorite={handleFavoritePress}
      // ❌ DON'T disable entire card during toggle - useFavoriteToggle has race condition protection
      disabled={props.disabled ?? false}
    />
  );
};

export const FavoriteOfferCard = memo(FavoriteOfferCardComponent);
FavoriteOfferCard.displayName = 'FavoriteOfferCard';
