import type { Schema, SchemaType } from 'mongoose';

import { OrderSchema } from '../../schemas/order.schema';
import { STRIP_PATHS, KEEP_PATHS } from '../merchant-order-view';

/**
 * Every money-or-payment-shaped path in `OrderSchema` must be classified in
 * `merchant-order-view.ts` as either kept or stripped from a merchant /
 * location-manager order view. A field added to the schema later that
 * matches this regex and is classified nowhere fails this test until someone
 * decides KEEP or STRIP for it - the check the brief asked for instead of a
 * reminder in a rules file.
 *
 * Mirrors task-15-brief.md correction 2, verbatim regex.
 */
const MONEY_PATH_PATTERN =
  /fee|total|amount|earning|commission|price|payMerchant|collect|keeps|payUrl|session|transaction|intent/i;

/**
 * Walks every path Mongoose knows about on `schema`, including paths nested
 * inside a single embedded object (already flattened by Mongoose into dotted
 * top-level paths) and paths nested inside an array of subdocuments (which
 * Mongoose does NOT flatten - reached only via `schemaType.schema`).
 */
function collectAllPaths(schema: Schema, prefix = ''): string[] {
  const paths: string[] = [];
  schema.eachPath((pathName, schemaType: SchemaType) => {
    if (pathName === '_id' || pathName === '__v') {
      return;
    }
    const full = prefix ? `${prefix}.${pathName}` : pathName;
    paths.push(full);

    const nestedSchema = (schemaType as unknown as { schema?: Schema }).schema;
    if (nestedSchema) {
      paths.push(...collectAllPaths(nestedSchema, full));
    }
  });
  return paths;
}

describe('merchant order view - schema coverage', () => {
  const allPaths = collectAllPaths(OrderSchema);
  const moneyPaths = allPaths.filter(p => MONEY_PATH_PATTERN.test(p));

  it('found at least the known money-shaped paths (sanity check the walker itself)', () => {
    // If this list shrinks, the walker broke, not the schema.
    expect(moneyPaths).toEqual(
      expect.arrayContaining(['pricing.total', 'commission.merchantAmount', 'paymentSession']),
    );
  });

  it('classifies every money-shaped schema path as KEEP or STRIP', () => {
    const unclassified = moneyPaths.filter(p => !STRIP_PATHS.has(p) && !KEEP_PATHS.has(p));
    expect(unclassified).toEqual([]);
  });

  it('never classifies the same path as both KEEP and STRIP', () => {
    const both = moneyPaths.filter(p => STRIP_PATHS.has(p) && KEEP_PATHS.has(p));
    expect(both).toEqual([]);
  });

  it('has no stale entries - every KEEP/STRIP path still exists on the schema', () => {
    const allPathSet = new Set(allPaths);
    const stale = [...STRIP_PATHS, ...KEEP_PATHS].filter(p => !allPathSet.has(p));
    expect(stale).toEqual([]);
  });
});
