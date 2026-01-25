/**
 * FavoriteOfferCard Component
 * OfferCard with integrated favorites functionality
 *
 * Features:
 * - Automatic favorite status sync
 * - Optimistic UI updates
 * - One-tap favorite toggle
 */

import React from 'react';

import { OfferCard } from '@/design-system/components/organisms';

import { useOfferFavorite } from '../hooks';

import type { OfferCardProps } from '@/design-system/components/organisms/OfferCard/OfferCard.types';

/**
 * OfferCard with favorites integration
 * Wraps OfferCard and automatically handles favorite state
 */
export const FavoriteOfferCard: React.FC<
  Omit<OfferCardProps, 'isFavorite' | 'onFavorite'>
> = props => {
  const { offer } = props;

  // Get favorite status and toggle function
  const { isFavorite, toggle, isLoading } = useOfferFavorite(offer.id, offer.title, offer.image);

  return (
    <OfferCard
      {...props}
      isFavorite={isFavorite}
      onFavorite={toggle}
      disabled={(props.disabled ?? false) || isLoading}
    />
  );
};

export default FavoriteOfferCard;
