/**
 * =========================================
 * 🏆 PRIZE CLAIM INDEX SCOPING MIGRATION
 * =========================================
 *
 * Purpose: scope the unique { userId, cycleNumber } index on `prizeclaims` to
 * bag-goal claims only.
 *
 * Why this cannot be a code-only change:
 *
 * The index already exists without a partialFilterExpression. MongoDB refuses
 * to redefine an index whose options differ (IndexOptionsConflict, code 85) —
 * it must be dropped and recreated. In production `autoIndex` is false
 * (app.module.ts), so nothing would create it at all; in development Mongoose
 * would try, hit the conflict, log it, and leave the OLD index in place. Either
 * way the bug survives a deploy unless this runs.
 *
 * The bug: voting claims store `cycleNumber` from the VotingCycle sequence,
 * which counts independently of the CommunityBagGoal sequence. As soon as the
 * two numbers coincide, a user who claimed a season prize is refused their
 * voting prize by the unique index — and since E11000 is now mapped to a 409,
 * it reads as "you have already claimed" rather than as a fault.
 *
 * Usage:
 *   pnpm migration:scope-prize-index              # Dry run (preview)
 *   pnpm migration:scope-prize-index:execute      # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION = 'prizeclaims';
const INDEX_NAME = 'userId_1_cycleNumber_1';
const KEYS = { userId: 1, cycleNumber: 1 } as const;
const PARTIAL_FILTER = { source: 'bag_goal' } as const;

const dryRun = !process.argv.includes('--execute');

const log = (msg: string): void => {
  // eslint-disable-next-line no-console
  console.log(msg);
};

async function run(): Promise<void> {
  // DATABASE_URL, matching verify-indexes.ts and the other migrations — the
  // app itself reads it through ConfigService, but scripts run outside Nest.
  const uri = process.env['DATABASE_URL'];
  if (!uri) {
    throw new Error('DATABASE_URL is not set. Configure .env before running this migration.');
  }

  // Use the connection `connect` hands back rather than the default
  // `mongoose.connection` singleton — under ts-node's CommonJS interop the
  // namespace import does not always expose it.
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
    log('Mongoose will create the scoped index on next sync.');
    return;
  }

  const alreadyScoped =
    JSON.stringify(existing.partialFilterExpression ?? null) === JSON.stringify(PARTIAL_FILTER);

  if (alreadyScoped) {
    log(`${INDEX_NAME} is already scoped to ${JSON.stringify(PARTIAL_FILTER)}. Nothing to do.`);
    return;
  }

  log(`Found ${INDEX_NAME} with options: ${JSON.stringify(existing)}`);

  /*
   * Anything that would violate the *new* index is a pre-existing duplicate and
   * must be resolved by hand — recreating would fail halfway and leave the
   * collection with no unique guard at all. Check before touching the index.
   */
  const duplicates = await collection
    .aggregate([
      { $match: PARTIAL_FILTER },
      { $group: { _id: { userId: '$userId', cycleNumber: '$cycleNumber' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicates.length > 0) {
    log(`ABORT: ${duplicates.length} duplicate bag-goal claim(s) would violate the new index:`);
    for (const d of duplicates) {
      log(`  ${JSON.stringify(d['_id'])} — ${String(d['n'])} claims`);
    }
    log('Resolve these by hand before re-running.');
    return;
  }

  if (dryRun) {
    log('');
    log('DRY RUN — would perform:');
    log(`  1. db.${COLLECTION}.dropIndex("${INDEX_NAME}")`);
    log(
      `  2. db.${COLLECTION}.createIndex(${JSON.stringify(KEYS)}, ` +
        `{ unique: true, partialFilterExpression: ${JSON.stringify(PARTIAL_FILTER)} })`,
    );
    log('');
    log('Re-run with --execute to apply.');
    return;
  }

  /*
   * There is a window between the drop and the create where no unique guard
   * exists. It is short, and the alternative — building the scoped index under
   * a different name first — leaves two unique indexes live at once, which
   * rejects exactly the writes this migration is meant to allow.
   */
  log(`Dropping ${INDEX_NAME}...`);
  await collection.dropIndex(INDEX_NAME);

  log('Creating scoped index...');
  await collection.createIndex(KEYS, {
    unique: true,
    partialFilterExpression: PARTIAL_FILTER,
    name: INDEX_NAME,
  });

  const after = (await collection.indexes()).find(i => i.name === INDEX_NAME);
  log(`Done. New options: ${JSON.stringify(after)}`);
}

run()
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
