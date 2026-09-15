/**
 * `SearchOffersDto.establishmentTypes` must accept both query-string shapes.
 *
 * WHAT THIS CAUGHT
 * ----------------
 * Express hands `?establishmentTypes=cafe` to the DTO as a **string** and
 * `?establishmentTypes=a&establishmentTypes=b` as an **array**. With a bare
 * `@IsArray()` the single-value form failed validation:
 *
 *     400 Validation failed: establishmentTypes must be an array
 *
 * Every home category that maps to exactly one establishment type — Cafe,
 * Supermarket, Hotel, Wholesaler — sends the single-value form, so tapping any
 * of them made the Hottest Deals carousel 400 while the other three carousels
 * filtered fine. Found only by driving the real endpoint; no unit test
 * exercised the DTO with a raw query value.
 *
 * The fix coerces **shape only**. Enum validation still runs afterwards, which
 * the last two cases here exist to prove — a coercion that also dropped unknown
 * values would have made the endpoint silently accept garbage.
 */

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { EstablishmentType } from '@foodwaste/shared';

import { SearchOffersDto } from '../search-offers.dto';

/** Mirrors the global ValidationPipe's transform behaviour. */
const parse = (query: Record<string, unknown>) => {
  const dto = plainToInstance(SearchOffersDto, query, { enableImplicitConversion: true });
  return { dto, errors: validateSync(dto, { whitelist: true }) };
};

const errorFor = (errors: ReturnType<typeof validateSync>, prop: string) =>
  errors.find(e => e.property === prop);

describe('SearchOffersDto.establishmentTypes', () => {
  it('accepts a single value sent as a bare string', () => {
    // The exact request that used to 400.
    const { dto, errors } = parse({ establishmentTypes: 'cafe' });

    expect(errorFor(errors, 'establishmentTypes')).toBeUndefined();
    expect(dto.establishmentTypes).toEqual([EstablishmentType.CAFE]);
  });

  it('accepts repeated params as an array', () => {
    const { dto, errors } = parse({ establishmentTypes: ['bakery', 'pastry_shop'] });

    expect(errorFor(errors, 'establishmentTypes')).toBeUndefined();
    expect(dto.establishmentTypes).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.PASTRY_SHOP,
    ]);
  });

  it('accepts a comma-joined list', () => {
    const { dto, errors } = parse({ establishmentTypes: 'bakery,cafe' });

    expect(errorFor(errors, 'establishmentTypes')).toBeUndefined();
    expect(dto.establishmentTypes).toEqual([EstablishmentType.BAKERY, EstablishmentType.CAFE]);
  });

  it('trims whitespace around comma-joined values', () => {
    const { dto, errors } = parse({ establishmentTypes: ' bakery , cafe ' });

    expect(errorFor(errors, 'establishmentTypes')).toBeUndefined();
    expect(dto.establishmentTypes).toEqual([EstablishmentType.BAKERY, EstablishmentType.CAFE]);
  });

  it.each(['cafe', 'supermarket', 'hotel', 'wholesaler'])(
    'accepts %s, the single-type categories that used to 400',
    type => {
      const { errors } = parse({ establishmentTypes: type });
      expect(errorFor(errors, 'establishmentTypes')).toBeUndefined();
    },
  );

  it('leaves the field undefined when absent', () => {
    const { dto, errors } = parse({ limit: 10 });

    expect(errorFor(errors, 'establishmentTypes')).toBeUndefined();
    expect(dto.establishmentTypes).toBeUndefined();
  });

  // ── The coercion must not become a validator ──────────────────────────────

  it('still rejects a value that is not in the enum', () => {
    // The coercion fixes shape only. If it also filtered unknowns, this would
    // pass and the endpoint would silently accept anything.
    const { errors } = parse({ establishmentTypes: 'not_a_type' });

    expect(errorFor(errors, 'establishmentTypes')).toBeDefined();
  });

  it('still rejects a mixed list containing an unknown value', () => {
    const { errors } = parse({ establishmentTypes: ['bakery', 'not_a_type'] });

    expect(errorFor(errors, 'establishmentTypes')).toBeDefined();
  });
});
