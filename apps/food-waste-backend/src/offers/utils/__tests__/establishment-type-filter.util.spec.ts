/**
 * Establishment-type filter normalisation and its cache-key segment.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS
 * -----------------------------------
 * `getUrgentOffers` serves a shared cached page, keyed and then personalised
 * per viewer. Once the endpoint accepts `establishmentTypes`, the key must
 * distinguish filters or two different requests read the same entry — a user
 * filtering for bakeries gets whatever filter warmed the cache first. That
 * failure is invisible: the response is well-formed, just wrong, and only for
 * the second caller.
 *
 * The other half is determinism. `[bakery,cafe]` and `[cafe,bakery]` are the
 * same query, and if they produce two keys the cache fragments without bound —
 * eight categories would be up to 8! orderings of the same few sets.
 *
 * So there are exactly two properties here, and both are asserted directly:
 *
 *   1. different filters  -> different keys
 *   2. equivalent filters -> identical keys, whatever order or duplication
 */

import { EstablishmentType } from '@foodwaste/shared';

import {
  normalizeEstablishmentTypes,
  establishmentTypeCacheSegment,
  resolveEstablishmentTypeFilter,
} from '../establishment-type-filter.util';

const keyFor = (types?: readonly string[] | string | null): string =>
  `offers:urgent:1:1:10${resolveEstablishmentTypeFilter(types).cacheSegment}`;

// ============================================================================
// Normalisation
// ============================================================================

describe('normalizeEstablishmentTypes', () => {
  it('returns undefined for no filter', () => {
    expect(normalizeEstablishmentTypes(undefined)).toBeUndefined();
    expect(normalizeEstablishmentTypes(null)).toBeUndefined();
  });

  it('returns undefined for an empty list, never an empty array', () => {
    // `undefined` lets every caller treat "no filter" as one condition. An
    // empty array would be a second thing to remember at every call site.
    expect(normalizeEstablishmentTypes([])).toBeUndefined();
    expect(normalizeEstablishmentTypes('')).toBeUndefined();
  });

  it('accepts a single value as a bare string', () => {
    // `?establishmentTypes=bakery` arrives as a string, not an array.
    expect(normalizeEstablishmentTypes('bakery')).toEqual([EstablishmentType.BAKERY]);
  });

  it('accepts a comma-joined list', () => {
    expect(normalizeEstablishmentTypes('bakery,cafe')).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.CAFE,
    ]);
  });

  it('accepts repeated params as an array', () => {
    expect(normalizeEstablishmentTypes(['bakery', 'cafe'])).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.CAFE,
    ]);
  });

  it('sorts, so argument order cannot create a second cache entry', () => {
    expect(normalizeEstablishmentTypes(['cafe', 'bakery'])).toEqual(
      normalizeEstablishmentTypes(['bakery', 'cafe']),
    );
  });

  it('removes duplicates', () => {
    expect(normalizeEstablishmentTypes(['bakery', 'bakery', 'cafe'])).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.CAFE,
    ]);
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEstablishmentTypes(' bakery , cafe ')).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.CAFE,
    ]);
  });

  it('drops values that are not in the enum', () => {
    // Without this an old or hostile client could mint unbounded cache keys
    // from free text.
    expect(normalizeEstablishmentTypes(['bakery', 'hovercraft_rental'])).toEqual([
      EstablishmentType.BAKERY,
    ]);
  });

  it('returns undefined when every value is unknown', () => {
    expect(normalizeEstablishmentTypes(['nope', 'also_nope'])).toBeUndefined();
  });

  it('accepts every member of the enum', () => {
    const all = Object.values(EstablishmentType);
    expect(normalizeEstablishmentTypes(all)).toHaveLength(all.length);
  });

  it('is idempotent', () => {
    const once = normalizeEstablishmentTypes(['cafe', 'bakery', 'bakery']);
    expect(normalizeEstablishmentTypes(once)).toEqual(once);
  });
});

// ============================================================================
// Cache key
// ============================================================================

describe('cache key', () => {
  it('leaves the unfiltered key byte-identical to the pre-filter format', () => {
    // The existing warm cache stays valid and
    // `invalidateDiscoveryCaches('offers:urgent:')` keeps matching by prefix.
    expect(keyFor(undefined)).toBe('offers:urgent:1:1:10');
    expect(keyFor([])).toBe('offers:urgent:1:1:10');
    expect(establishmentTypeCacheSegment(undefined)).toBe('');
    expect(establishmentTypeCacheSegment([])).toBe('');
  });

  it('uses the documented `:types=a,b` format', () => {
    expect(keyFor(['bakery', 'cafe'])).toBe('offers:urgent:1:1:10:types=bakery,cafe');
  });

  it('keeps the `offers:urgent:` prefix so prefix invalidation still purges it', () => {
    expect(keyFor(['bakery']).startsWith('offers:urgent:')).toBe(true);
  });

  // ── Property 1: different filters must not share an entry ─────────────────

  it('gives different filters different keys', () => {
    expect(keyFor(['bakery'])).not.toBe(keyFor(['cafe']));
  });

  it('gives a subset a different key from its superset', () => {
    // [bakery] must not be served the [bakery,cafe] page — it would show cafes.
    expect(keyFor(['bakery'])).not.toBe(keyFor(['bakery', 'cafe']));
  });

  it('gives the unfiltered request a different key from any filtered one', () => {
    expect(keyFor(undefined)).not.toBe(keyFor(['bakery']));
  });

  it('produces a distinct key for every single category', () => {
    const keys = Object.values(EstablishmentType).map(t => keyFor([t]));
    expect(new Set(keys).size).toBe(keys.length);
  });

  // ── Property 2: equivalent filters must share an entry ────────────────────

  it('gives reordered input the same key', () => {
    expect(keyFor(['cafe', 'bakery'])).toBe(keyFor(['bakery', 'cafe']));
  });

  it('gives duplicated input the same key', () => {
    expect(keyFor(['bakery', 'bakery'])).toBe(keyFor(['bakery']));
  });

  it('gives comma-joined and repeated-param forms the same key', () => {
    expect(keyFor('bakery,cafe')).toBe(keyFor(['bakery', 'cafe']));
  });

  it('gives whitespace-padded input the same key', () => {
    expect(keyFor([' bakery', 'cafe '])).toBe(keyFor(['bakery', 'cafe']));
  });

  it('ignores unknown values when comparing, rather than keying on them', () => {
    expect(keyFor(['bakery', 'not_a_type'])).toBe(keyFor(['bakery']));
  });

  it('collapses every permutation of one set onto a single key', () => {
    const permutations = [
      ['bakery', 'cafe', 'hotel'],
      ['cafe', 'hotel', 'bakery'],
      ['hotel', 'bakery', 'cafe'],
      ['hotel', 'cafe', 'bakery', 'bakery'],
    ];
    expect(new Set(permutations.map(keyFor)).size).toBe(1);
  });
});
