/**
 * Grouping for the search list view: one section per establishment.
 */

import type { NearbyOffer, ProximitySearchResult } from '@/features/offers/hooks';

export interface EstablishmentGroup {
  establishmentId: string;
  establishmentName: string;
  establishmentLogo: string | null;
  offers: ProximitySearchResult<NearbyOffer>[];
}

/**
 * Stable empty fallback. `offers ?? []` allocates a new array on every render
 * while the query is loading, which changes the identity of the grouped value
 * each time and makes the useMemo recompute forever. One frozen constant keeps
 * the identity stable.
 */
export const NO_OFFERS: ProximitySearchResult<NearbyOffer>[] = [];

/**
 * Group offers by establishment, preserving first-seen order — the backend
 * returns them nearest-first, so the sections come out nearest-first too.
 */
export const groupOffersByEstablishment = (
  offers: ProximitySearchResult<NearbyOffer>[],
): EstablishmentGroup[] => {
  const map = new Map<string, EstablishmentGroup>();

  for (const result of offers) {
    const { establishmentId, establishmentName, establishmentLogo } = result.item;
    const existing = map.get(establishmentId);

    if (existing) {
      existing.offers.push(result);
    } else {
      map.set(establishmentId, {
        establishmentId,
        establishmentName,
        establishmentLogo,
        offers: [result],
      });
    }
  }

  return Array.from(map.values());
};
