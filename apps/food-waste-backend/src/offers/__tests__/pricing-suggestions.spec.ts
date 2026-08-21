/**
 * The pricing guide is advice a merchant acts on, so every number it shows has
 * to be defensible.
 *
 * Four things the previous implementation got wrong, each pinned here:
 *
 *  1. It shipped English sentences from the server, so French and Arabic
 *     merchants read English inside their own dashboard. The response must now
 *     carry keys and numbers only.
 *  2. The "zone average" included the merchant's own offers, so a merchant
 *     alone in their city was compared against themselves.
 *  3. A pastry shop was averaged together with restaurants and supermarkets.
 *  4. Best day / best hour bucketed in UTC, which is an hour off for Tunisia.
 *
 * `Object.create` on the real prototype so the aggregation building and the
 * rule engine under test are the real code; only the two data boundaries — the
 * model and the establishments lookup — are stubbed.
 */

import { EstablishmentType } from '@foodwaste/shared';
import { Types } from 'mongoose';

import { OffersService } from '../offers.service';

import type { PricingInsightType } from '../offers.service';

const MERCHANT_ID = new Types.ObjectId().toString();

interface FacetResult {
  pricing: Array<Record<string, number>>;
  fill: Array<Record<string, number>>;
  soldOut: Array<Record<string, number>>;
  byDay: Array<{ _id: number; sold: number }>;
  byHour: Array<{ _id: number; sold: number }>;
}

interface ZoneResult {
  avgDiscountedPrice: number;
  avgFillRate: number;
  totalMerchants: number;
}

const emptyFacet = (): FacetResult => ({
  pricing: [],
  fill: [],
  soldOut: [],
  byDay: [],
  byHour: [],
});

interface HarnessOptions {
  facet?: Partial<FacetResult>;
  /** Peer stats for the same-type-same-city query. */
  categoryZone?: ZoneResult | null;
  /** Peer stats for the widened whole-city query. */
  cityZone?: ZoneResult | null;
  establishment?: { address?: { city?: string }; type?: EstablishmentType } | null;
}

const buildService = (opts: HarnessOptions = {}) => {
  const pipelines: Array<Record<string, unknown>[]> = [];

  const facet: FacetResult = { ...emptyFacet(), ...opts.facet };

  const aggregate = jest.fn((pipeline: Record<string, unknown>[]) => {
    pipelines.push(pipeline);

    const isFacet = pipeline.some(stage => '$facet' in stage);
    if (isFacet) {
      return { exec: jest.fn().mockResolvedValue([facet]) };
    }

    // Zone pipelines are distinguished by whether they narrow on establishment
    // type — the same way the service decides which one it is asking for.
    const matchStages = pipeline.filter(stage => '$match' in stage) as Array<{
      $match: Record<string, unknown>;
    }>;
    const narrowsOnType = matchStages.some(stage => 'est.type' in stage.$match);

    const zone = narrowsOnType
      ? (opts.categoryZone ?? null)
      : (opts.cityZone ?? opts.categoryZone ?? null);

    return { exec: jest.fn().mockResolvedValue(zone ? [zone] : []) };
  });

  const establishment =
    opts.establishment === null
      ? undefined
      : (opts.establishment ?? {
          address: { city: 'Tunis' },
          type: EstablishmentType.PASTRY_SHOP,
        });

  const service = Object.create(OffersService.prototype) as OffersService;
  Object.assign(service, {
    offerModel: { aggregate },
    establishmentsService: {
      findByOwnerId: jest
        .fn()
        .mockResolvedValue({ establishments: establishment ? [establishment] : [] }),
    },
  });

  return { service, aggregate, pipelines };
};

/** Enough finished offers to clear every evidence gate in the rule engine. */
const healthyFacet = (over: Partial<FacetResult> = {}): Partial<FacetResult> => ({
  pricing: [
    {
      avgDiscountedPrice: 6,
      avgOriginalPrice: 15,
      avgDiscountPercent: 60,
      totalOffers: 10,
      totalSold: 40,
    },
  ],
  fill: [{ totalQuantity: 50, soldQuantity: 40, offers: 8 }],
  soldOut: [{ avgSoldOutPrice: 6, offers: 5 }],
  ...over,
});

describe('OffersService — pricing suggestions', () => {
  describe('no prose crosses the API boundary', () => {
    it('emits keys and numeric params only, never a rendered sentence', async () => {
      const { service } = buildService({
        facet: healthyFacet({ byDay: [{ _id: 3, sold: 12 }] }),
        categoryZone: { avgDiscountedPrice: 4, avgFillRate: 70, totalMerchants: 6 },
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.insights.length).toBeGreaterThan(0);
      for (const insight of result.insights) {
        expect(insight).not.toHaveProperty('message');
        expect(Object.values(insight.params).every(v => typeof v === 'number')).toBe(true);
      }
      // Nothing anywhere in the payload may be a human-language sentence.
      expect(JSON.stringify(result)).not.toMatch(/[Yy]our average|consider|faster/);
    });
  });

  describe('the peer set is a comparison, not a mirror', () => {
    it("excludes the merchant's own offers from every zone aggregation", async () => {
      const { service, pipelines } = buildService({
        facet: healthyFacet(),
        categoryZone: { avgDiscountedPrice: 5, avgFillRate: 60, totalMerchants: 4 },
      });

      await service.getPricingSuggestions(MERCHANT_ID);

      const zonePipelines = pipelines.filter(p => !p.some(stage => '$facet' in stage));
      expect(zonePipelines.length).toBeGreaterThan(0);
      for (const pipeline of zonePipelines) {
        const [first] = pipeline as Array<{ $match: Record<string, unknown> }>;
        expect(first?.$match?.['merchantId']).toEqual({ $ne: new Types.ObjectId(MERCHANT_ID) });
      }
    });

    it('compares like with like when there are enough same-type peers', async () => {
      const { service, pipelines } = buildService({
        facet: healthyFacet(),
        categoryZone: { avgDiscountedPrice: 5, avgFillRate: 60, totalMerchants: 4 },
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.zoneStats.scope).toBe('category_city');
      expect(result.zoneStats.totalMerchants).toBe(4);
      // Only the narrow query should have run — no need to widen.
      expect(pipelines.filter(p => !p.some(s => '$facet' in s))).toHaveLength(1);
    });

    it('widens to the whole city when the same-type peer set is too thin', async () => {
      const { service } = buildService({
        facet: healthyFacet(),
        categoryZone: { avgDiscountedPrice: 5, avgFillRate: 60, totalMerchants: 2 },
        cityZone: { avgDiscountedPrice: 9, avgFillRate: 55, totalMerchants: 11 },
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.zoneStats.scope).toBe('city');
      expect(result.zoneStats.avgDiscountedPrice).toBe(9);
    });

    it('suppresses the comparison entirely when there are no peers at all', async () => {
      const { service } = buildService({
        facet: healthyFacet(),
        categoryZone: null,
        cityZone: null,
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.zoneStats.scope).toBe('none');
      expect(result.zoneStats.avgDiscountedPrice).toBe(0);
      expect(result.insights.map(i => i.type)).not.toContain('price_above_zone');
      expect(result.insights.map(i => i.type)).not.toContain('price_below_zone');
    });

    it('does not query peers at all when the establishment has no city', async () => {
      const { service, pipelines } = buildService({
        facet: healthyFacet(),
        establishment: { type: EstablishmentType.PASTRY_SHOP },
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.zoneStats.scope).toBe('none');
      expect(pipelines.filter(p => !p.some(s => '$facet' in s))).toHaveLength(0);
    });

    it('still compares city-wide when the establishment has a city but no type', async () => {
      const { service } = buildService({
        facet: healthyFacet(),
        establishment: { address: { city: 'Sfax' } },
        cityZone: { avgDiscountedPrice: 7, avgFillRate: 50, totalMerchants: 5 },
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.zoneStats.scope).toBe('city');
    });
  });

  describe('suggested range', () => {
    it('prefers the merchant own sold-out prices once there are enough of them', async () => {
      const { service } = buildService({
        facet: healthyFacet({ soldOut: [{ avgSoldOutPrice: 10, offers: 3 }] }),
        categoryZone: { avgDiscountedPrice: 4, avgFillRate: 60, totalMerchants: 8 },
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.suggestedPriceRange).toEqual({
        min: 9,
        max: 11,
        currency: 'TND',
        basis: 'own_history',
      });
    });

    it('falls back to peers below the own-history threshold', async () => {
      const { service } = buildService({
        facet: healthyFacet({ soldOut: [{ avgSoldOutPrice: 10, offers: 2 }] }),
        categoryZone: { avgDiscountedPrice: 4, avgFillRate: 60, totalMerchants: 8 },
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.suggestedPriceRange).toEqual({
        min: 3.4,
        max: 4.4,
        currency: 'TND',
        basis: 'zone',
      });
    });

    it('is null when there is neither own history nor a peer set', async () => {
      const { service } = buildService({ facet: healthyFacet({ soldOut: [] }) });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.suggestedPriceRange).toBeNull();
    });

    it('never returns a floor above its own ceiling on a very cheap anchor', async () => {
      // The 1 TND floor overtakes a 0.55 ceiling; the range must stay coherent.
      const { service } = buildService({
        facet: healthyFacet({ soldOut: [{ avgSoldOutPrice: 0.5, offers: 4 }] }),
      });

      const range = (await service.getPricingSuggestions(MERCHANT_ID)).suggestedPriceRange;

      expect(range).not.toBeNull();
      expect(range!.min).toBe(1);
      expect(range!.max).toBeGreaterThanOrEqual(range!.min);
    });
  });

  describe('advice is gated on having evidence for it', () => {
    it('withholds fill-rate advice below the sample threshold', async () => {
      const { service } = buildService({
        facet: healthyFacet({ fill: [{ totalQuantity: 10, soldQuantity: 1, offers: 2 }] }),
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.merchantStats.fillRate).toBe(10);
      expect(result.insights.map(i => i.type)).not.toContain('low_fill_rate');
    });

    it('gives fill-rate advice once the sample is large enough', async () => {
      const { service } = buildService({
        facet: healthyFacet({ fill: [{ totalQuantity: 10, soldQuantity: 1, offers: 3 }] }),
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.insights).toContainEqual({
        type: 'low_fill_rate',
        impact: 'high',
        params: { fillRate: 10 },
      });
    });

    it('withholds best-day and best-hour advice below the sold-out threshold', async () => {
      const { service } = buildService({
        facet: healthyFacet({
          soldOut: [{ avgSoldOutPrice: 6, offers: 2 }],
          byDay: [{ _id: 3, sold: 9 }],
          byHour: [{ _id: 17, sold: 9 }],
        }),
      });

      const types = (await service.getPricingSuggestions(MERCHANT_ID)).insights.map(i => i.type);

      expect(types).not.toContain('best_day');
      expect(types).not.toContain('best_hour');
    });

    it('converts Mongo 1-indexed weekdays to the 0-indexed day the client expects', async () => {
      const { service } = buildService({
        facet: healthyFacet({ byDay: [{ _id: 3, sold: 9 }] }), // 3 = Tuesday
      });

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.merchantStats.bestDayOfWeek).toBe(2);
      expect(result.insights).toContainEqual({
        type: 'best_day',
        impact: 'medium',
        params: { day: 2 },
      });
    });
  });

  describe('price-vs-peers thresholds', () => {
    const zone = { avgDiscountedPrice: 10, avgFillRate: 60, totalMerchants: 8 };

    it.each([
      ['exactly at the +15% edge', 11.5, []],
      ['just past the +15% edge', 11.6, ['price_above_zone']],
      ['exactly at the -20% edge', 8, []],
      ['just past the -20% edge', 7.9, ['price_below_zone']],
    ])('%s', async (_label, avgDiscountedPrice, expected) => {
      const { service } = buildService({
        facet: healthyFacet({
          pricing: [
            {
              avgDiscountedPrice,
              avgOriginalPrice: 20,
              avgDiscountPercent: 60,
              totalOffers: 10,
              totalSold: 40,
            },
          ],
        }),
        categoryZone: zone,
      });

      const types = (await service.getPricingSuggestions(MERCHANT_ID)).insights.map(i => i.type);

      for (const t of ['price_above_zone', 'price_below_zone'] as PricingInsightType[]) {
        expect(types.includes(t)).toBe(expected.includes(t));
      }
    });
  });

  describe('local time, not UTC', () => {
    it('buckets best day and best hour in Africa/Tunis', async () => {
      const { service, pipelines } = buildService({ facet: healthyFacet() });

      await service.getPricingSuggestions(MERCHANT_ID);

      const facetStage = pipelines
        .flat()
        .find((stage): stage is { $facet: Record<string, unknown[]> } => '$facet' in stage);

      expect(JSON.stringify(facetStage!.$facet['byDay'])).toContain('Africa/Tunis');
      expect(JSON.stringify(facetStage!.$facet['byHour'])).toContain('Africa/Tunis');
    });

    it('falls back to createdAt when an offer has no publishedAt', async () => {
      const { service, pipelines } = buildService({ facet: healthyFacet() });

      await service.getPricingSuggestions(MERCHANT_ID);

      const facetStage = pipelines
        .flat()
        .find((stage): stage is { $facet: Record<string, unknown[]> } => '$facet' in stage);

      expect(JSON.stringify(facetStage!.$facet['byHour'])).toContain('$ifNull');
    });
  });

  describe('a merchant with no history', () => {
    it('returns a zeroed, insight-free payload rather than throwing', async () => {
      const { service } = buildService();

      const result = await service.getPricingSuggestions(MERCHANT_ID);

      expect(result.merchantStats.totalOffers).toBe(0);
      expect(result.merchantStats.fillRate).toBe(0);
      expect(result.merchantStats.bestDayOfWeek).toBeNull();
      expect(result.merchantStats.bestHour).toBeNull();
      expect(result.insights).toEqual([]);
      expect(result.suggestedPriceRange).toBeNull();
      expect(result.sample).toEqual({
        windowDays: 60,
        merchantOffers: 0,
        merchantSoldOutOffers: 0,
        peerMerchants: 0,
      });
    });
  });
});
