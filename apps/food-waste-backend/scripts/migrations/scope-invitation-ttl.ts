/**
 * =========================================
 * 📨 INVITATION TTL SCOPING MIGRATION
 * =========================================
 *
 * Purpose: stop the `organizationinvitations` TTL from deleting **accepted**
 * invitations. Scope it to invitations that were never acted on.
 *
 * The bug: the TTL is `{ expiresAt: 1 }, expireAfterSeconds: 0` with no filter, so
 * MongoDB deletes *every* invitation once `expiresAt` passes — regardless of status.
 * An accepted invitation is the record of who was granted access to an organisation,
 * and it was being erased roughly a week after the grant. Two such records were
 * already lost before this was caught.
 *
 * The new filter keeps `accepted` and `revoked` (deliberate outcomes, volume bounded
 * by human action) and expires only `pending` and `expired`.
 *
 * `expired` is included because it is `pending` one step later: the accept handler
 * lazily flips a lapsed pending invitation to `expired` when someone clicks a stale
 * link, purely to return a clearer error. Filtering on `pending` alone would leave
 * those tombstones in the collection forever — trading one leak for another.
 *
 * Why this cannot be a code-only change:
 *
 * The index already exists without a partialFilterExpression, and MongoDB refuses to
 * redefine an index whose options differ (IndexOptionsConflict, code 85) — it must be
 * dropped and recreated. In production `autoIndex` is false (app.module.ts), so
 * nothing would create it; in development Mongoose would hit the conflict, log it,
 * and leave the OLD unfiltered index in place. Either way the data loss continues
 * after a deploy unless this runs.
 *
 * `$in` inside a partialFilterExpression requires MongoDB 6.0+ (cluster runs 8.0).
 *
 * Usage:
 *   pnpm migration:scope-invitation-ttl              # Dry run (preview)
 *   pnpm migration:scope-invitation-ttl:execute      # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION = 'organizationinvitations';
const INDEX_NAME = 'expiresAt_1';
const KEYS = { expiresAt: 1 } as const;
const PARTIAL_FILTER = { status: { $in: ['pending', 'expired'] } } as const;

const dryRun = !process.argv.includes('--execute');

const log = (msg: string): void => {
  console.log(msg);
};

async function run(): Promise<void> {
  const uri = process.env['DATABASE_URL'];
  if (!uri) {
    throw new Error('DATABASE_URL is not set. Configure .env before running this migration.');
  }

  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('No database handle after connecting.');
  }
  const collection = db.collection(COLLECTION);

  const indexes = await collection.indexes();
  const existing = indexes.find(i => i.name === INDEX_NAME);

  if (!existing) {
    log(`No ${INDEX_NAME} index on ${COLLECTION}. Nothing to migrate.`);
    log('Run `pnpm db:create-indexes` to create the scoped index from the schema.');
    return;
  }

  const alreadyScoped =
    JSON.stringify(existing.partialFilterExpression ?? null) === JSON.stringify(PARTIAL_FILTER);

  if (alreadyScoped) {
    log(`${INDEX_NAME} is already scoped to ${JSON.stringify(PARTIAL_FILTER)}. Nothing to do.`);
    return;
  }

  log(`Found ${INDEX_NAME} with options: ${JSON.stringify(existing)}`);

  // How many accepted/revoked records the current index would still delete. Purely
  // informational — they are what this migration protects from here on.
  const atRisk = await collection.countDocuments({
    status: { $in: ['accepted', 'revoked'] },
    expiresAt: { $lt: new Date() },
  });
  log(`Accepted/revoked invitations past expiry, currently exposed to deletion: ${atRisk}`);

  const byStatus = await collection
    .aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
    .toArray();
  log(`Current counts by status: ${JSON.stringify(byStatus)}`);

  if (dryRun) {
    log('');
    log('DRY RUN — would perform:');
    log(`  1. db.${COLLECTION}.dropIndex("${INDEX_NAME}")`);
    log(
      `  2. db.${COLLECTION}.createIndex(${JSON.stringify(KEYS)}, ` +
        `{ expireAfterSeconds: 0, partialFilterExpression: ${JSON.stringify(PARTIAL_FILTER)} })`,
    );
    log('');
    log('Re-run with --execute to apply.');
    return;
  }

  /*
   * Between the drop and the create there is no TTL on this collection. That is the
   * safe direction to fail: expired pending invitations linger a little longer,
   * rather than accepted ones being deleted. Nothing depends on the TTL for
   * correctness — the accept handler validates `expiresAt` itself.
   */
  log(`Dropping ${INDEX_NAME}...`);
  await collection.dropIndex(INDEX_NAME);

  log('Creating scoped TTL index...');
  await collection.createIndex(KEYS, {
    expireAfterSeconds: 0,
    partialFilterExpression: PARTIAL_FILTER,
    name: INDEX_NAME,
  });

  const after = (await collection.indexes()).find(i => i.name === INDEX_NAME);
  log(`Done. New options: ${JSON.stringify(after)}`);
}

run()
  .catch((err: unknown) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
