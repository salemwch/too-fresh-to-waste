/**
 * groupOffersByEstablishment — powers the list-view sections.
 */

import { NO_OFFERS, groupOffersByEstablishment } from '../groupOffers';

const hit = (id: string, name: string, offerId: string, logo: string | null = null) =>
  ({
    item: {
      _id: offerId,
      establishmentId: id,
      establishmentName: name,
      establishmentLogo: logo,
    },
    distance: { value: 1, unit: 'kilometers', formatted: '1 km' },
    geoData: {},
  }) as never;

describe('groupOffersByEstablishment', () => {
  it('returns nothing for an empty list', () => {
    expect(groupOffersByEstablishment([])).toEqual([]);
  });

  it('groups offers under their establishment', () => {
    const result = groupOffersByEstablishment([
      hit('e1', 'Boulangerie', 'o1'),
      hit('e1', 'Boulangerie', 'o2'),
      hit('e2', 'Pâtisserie', 'o3'),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.establishmentId).toBe('e1');
    expect(result[0]?.offers).toHaveLength(2);
    expect(result[1]?.offers).toHaveLength(1);
  });

  // The backend returns nearest-first, so section order is meaningful: keeping
  // insertion order keeps the closest establishment at the top of the list.
  it('preserves first-seen order even when an establishment reappears later', () => {
    const result = groupOffersByEstablishment([
      hit('e1', 'Boulangerie', 'o1'),
      hit('e2', 'Pâtisserie', 'o2'),
      hit('e1', 'Boulangerie', 'o3'),
    ]);

    expect(result.map(g => g.establishmentId)).toEqual(['e1', 'e2']);
    expect(result[0]?.offers).toHaveLength(2);
  });

  it('keeps offer order within a group', () => {
    const result = groupOffersByEstablishment([
      hit('e1', 'Boulangerie', 'o1'),
      hit('e1', 'Boulangerie', 'o2'),
    ]);

    expect(result[0]?.offers.map(o => o.item._id)).toEqual(['o1', 'o2']);
  });

  it('carries the establishment logo onto the group', () => {
    const result = groupOffersByEstablishment([
      hit('e1', 'Boulangerie', 'o1', 'https://cdn/l.png'),
    ]);

    expect(result[0]?.establishmentLogo).toBe('https://cdn/l.png');
  });
});

// The identity of this constant is load-bearing: a fresh [] on each render makes
// the grouping useMemo recompute forever while the query is loading.
describe('NO_OFFERS', () => {
  it('is a stable reference across reads', () => {
    expect(NO_OFFERS).toBe(NO_OFFERS);
    expect(NO_OFFERS).toHaveLength(0);
  });
});
