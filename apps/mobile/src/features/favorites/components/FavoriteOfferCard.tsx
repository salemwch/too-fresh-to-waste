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
 * isFavorite and the toggle both come from useFavoriteToggle, which owns the
 * React Query cache patch — so the displayed state and the optimistic write can
 * never disagree.
 */

import React, { memo, useCallback } from 'react';

import { OfferCard } from '@/design-system/components/organisms';

import { useFavoriteToggle } from '../hooks';

import type { OfferCardProps } from '@/design-system/components/organisms/OfferCard/OfferCard.types';

/**
 * OfferCard with favorites integration.
 *
 * Memoized — for this wrapper's own cost, not the card's.
 *
 * OfferCard is `memo`-wrapped and `toggle` is useCallback'd, so the expensive
 * card render was already skipped when props compared equal. What was NOT
 * skipped was this component: as a plain function it re-ran on every parent
 * render, once per card in the list, each time re-executing useFavoriteToggle
 * and re-reconciling the element — work whose only outcome
 * was the inner memo deciding nothing had changed.
 *
 * On a Home screen with four carousels that is a few dozen wasted hook cycles
 * per parent render. Cheap individually, which is exactly why it went unnoticed.
 */
const FavoriteOfferCardComponent: React.FC<Omit<OfferCardProps, 'onFavorite'>> = props => {
  const { offer } = props;

  // isFavorite comes back from the same hook that writes it, so the read and
  // the optimistic patch can never disagree.
  const { toggle, isFavorite } = useFavoriteToggle(offer.id, offer.title, offer.image);

  const handleFavoritePress = useCallback(() => {
    void toggle();
  }, [toggle]);

  return (
    <OfferCard
      {...props}
      isFavorite={isFavorite}
      onFavorite={handleFavoritePress}
      // ❌ DON'T disable entire card during toggle - useFavoriteToggle has race condition protection
      disabled={props.disabled ?? false}
    />
  );
};

export const FavoriteOfferCard = memo(FavoriteOfferCardComponent);
FavoriteOfferCard.displayName = 'FavoriteOfferCard';
