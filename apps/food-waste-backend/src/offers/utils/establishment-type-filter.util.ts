/**
 * Establishment-type filter normalisation, shared by every discovery endpoint
 * that caches a shared page.
 *
 * WHY THIS IS CENTRAL
 * -------------------
 * `getUrgentOffers` caches one page per `(hoursUntilExpiry, page, limit)` and
 * personalises it per viewer afterwards. Once the endpoint also accepts
 * `establishmentTypes`, that key stops identifying the response: a request for
 * bakeries and a request for cafes would read the same cached page and both get
 * whichever filter warmed it first.
 *
 * The filter therefore has to be part of the key — and the key has to be
 * *deterministic*, or the cache fragments without bounding: `[bakery,cafe]` and
 * `[cafe,bakery]` describe the same query and must not occupy two entries, and
 * `[bakery,bakery]` must not occupy a third.
 *
 * Normalising in one place is what makes that true everywhere. A second copy of
 * "sort and dedupe" is a second chance to sort differently.
 */

import { EstablishmentType } from '@foodwaste/shared';

/** Every value the enum allows, for O(1) membership checks. */
const VALID_TYPES = new Set<string>(Object.values(EstablishmentType));

/**
 * Canonical form of a requested establishment-type filter.
 *
 * - unknown values are dropped, so a stale client cannot poison a cache key
 *   with unbounded free text
 * - duplicates are removed
 * - the result is sorted, so argument order cannot produce a second entry
 * - an empty or absent filter normalises to `undefined`, never `[]`
 *
 * `undefined` rather than `[]` is deliberate: it lets every caller treat
 * "no filter" as one condition instead of two, and it is what keeps the
 * unfiltered cache key byte-identical to the one this endpoint used before the
 * filter existed.
 */
export function normalizeEstablishmentTypes(
  types?: readonly string[] | string | null,
): EstablishmentType[] | undefined {
  if (types === undefined || types === null) {
    return undefined;
  }

  // A single `?establishmentTypes=bakery` arrives as a string, several arrive
  // as an array. Comma-separated is accepted too, since that is how the mobile
  // client serialises repeated params.
  const raw = (Array.isArray(types) ? types : [types]).flatMap(value =>
    typeof value === 'string' ? value.split(',') : [],
  );

  const cleaned = raw.map(value => value.trim()).filter(value => VALID_TYPES.has(value));

  if (cleaned.length === 0) {
    return undefined;
  }

  return [...new Set(cleaned)].sort() as EstablishmentType[];
}

/**
 * The cache-key segment for a normalised filter.
 *
 * **Format:** `''` when unfiltered, otherwise `:types=<a>,<b>,<c>` with the
 * values already deduped and sorted by `normalizeEstablishmentTypes`.
 *
 * The empty string for the unfiltered case is the point: it leaves
 * `offers:urgent:1:1:10` exactly as it was, so the existing warm cache stays
 * valid and `invalidateDiscoveryCaches('offers:urgent:')` keeps matching by
 * prefix.
 */
export function establishmentTypeCacheSegment(types?: readonly EstablishmentType[]): string {
  if (types === undefined || types.length === 0) {
    return '';
  }
  return `:types=${types.join(',')}`;
}

/**
 * Build both at once, so a caller cannot normalise for the query and forget to
 * normalise for the key — which would cache one filter's results under
 * another's.
 */
export function resolveEstablishmentTypeFilter(types?: readonly string[] | string | null): {
  readonly types: EstablishmentType[] | undefined;
  readonly cacheSegment: string;
} {
  const normalized = normalizeEstablishmentTypes(types);
  return { types: normalized, cacheSegment: establishmentTypeCacheSegment(normalized) };
}

/**
 * Coerce a query-string value into an array, without judging its contents.
 *
 * Express gives `?establishmentTypes=cafe` as a **string** and
 * `?establishmentTypes=a&establishmentTypes=b` as an **array**. A DTO that
 * declares `@IsArray()` therefore rejects the single-value form with
 * "establishmentTypes must be an array" — which broke the Hottest Deals
 * carousel for every category that maps to exactly one type (Cafe,
 * Supermarket, Hotel, Wholesaler).
 *
 * This is deliberately **not** `normalizeEstablishmentTypes`: it only fixes
 * the shape. Sorting, de-duping and enum validation stay where they belong —
 * in `@IsEnum(..., { each: true })` for the validated DTO, and in
 * `normalizeEstablishmentTypes` for the raw `@Query` endpoints that feed a
 * cache key. Filtering unknown values here would silently weaken the DTO's
 * validation instead of fixing the shape bug.
 */
export function toEstablishmentTypeArray(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return value
    .split(',')
    .map(v => v.trim())
    .filter(v => v.length > 0);
}
