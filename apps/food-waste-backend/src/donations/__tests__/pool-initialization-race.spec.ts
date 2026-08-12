import { DonationPoolSchema, DonationPoolStatus } from '../schemas/donation-pool.schema';

/**
 * Regression cover for the duplicate-ACTIVE-pool race.
 *
 * `initializeDefaultPool()` runs in the service constructor, and the backend
 * runs PM2 in cluster mode — so it executes once per worker, simultaneously.
 * The read-then-create it used to do produced one ACTIVE pool per worker: four
 * workers, four pools, all created inside 600 ms on a real boot. That breaks
 * the invariant every donation read depends on, because `getActivePool()` is a
 * `findOne` and silently returns an arbitrary one of them.
 *
 * The guard has to live in the database. Application code cannot serialise
 * inserts across processes, and a plain upsert matching zero documents still
 * inserts once per caller. So what is asserted here is the index declaration
 * itself — if it is removed or weakened, the race comes back and nothing else
 * in the suite would notice.
 */
describe('donation pool startup race', () => {
  const indexes = DonationPoolSchema.indexes();

  const uniqueActiveIndex = indexes.find(
    ([, options]) => options?.name === 'uniq_single_active_pool',
  );

  it('declares a unique index restricting ACTIVE pools to one', () => {
    expect(uniqueActiveIndex).toBeDefined();

    const [fields, options] = uniqueActiveIndex as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];

    expect(fields).toEqual({ status: 1 });
    expect(options['unique']).toBe(true);
  });

  it('scopes the constraint to active, non-archived pools only', () => {
    const [, options] = uniqueActiveIndex as [unknown, Record<string, unknown>];

    // Without the partial filter this would allow only one pool per status
    // across the whole collection — funding a second goal would become
    // impossible, since FUNDED pools accumulate.
    expect(options['partialFilterExpression']).toEqual({
      status: DonationPoolStatus.ACTIVE,
      isArchived: false,
    });
  });

  it('does not combine sparse with partialFilterExpression', () => {
    const [, options] = uniqueActiveIndex as [unknown, Record<string, unknown>];

    // MongoDB rejects an index declaring both, and the rejection is silent in
    // the sense that the index simply never exists — the guard would look
    // present in code while enforcing nothing.
    expect(options['sparse']).toBeUndefined();
  });

  it('keeps a non-unique lookup index for the common active query', () => {
    // getActivePool filters on { status, isArchived }. The unique index is on
    // `status` alone, so the compound one still earns its place.
    const lookup = indexes.find(([fields]) => {
      const keys = fields as Record<string, unknown>;
      return keys['status'] === 1 && keys['isArchived'] === 1;
    });

    expect(lookup).toBeDefined();
  });
});
