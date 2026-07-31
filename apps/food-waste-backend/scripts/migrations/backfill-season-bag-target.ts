/**
 * =========================================
 * 🎯 SEASON BAG TARGET BACKFILL
 * =========================================
 *
 * Purpose: give every voting cycle a `seasonBagTarget`, so nothing reading one
 * gets `undefined`.
 *
 * The bug: `seasonBagTarget` is `@Prop({ required: true })` with no `default`.
 * `required` is a write validator — it says nothing about documents already in
 * the collection — and with no default there is nothing for Mongoose to fill in
 * on hydration. Cycles written before the field existed therefore come back
 * without the key. The admin voting page called `.toLocaleString()` on it,
 * threw, and React unmounted the route: seven Sentry events, and no admin could
 * open the screen that manages seasons.
 *
 * The frontend now renders an em dash instead of crashing (formatCount in
 * apps/web/src/lib/format.ts), but a dash is an admission that the number is
 * unknown, not a fix. This supplies the number.
 *
 * `minimumBags` and `recipientCount` sit next to it in the same schema and are
 * *not* affected: both declare a default, so Mongoose backfills them on read.
 * Only a required prop without a default has this failure mode — which is why
 * the schema now carries `default: DEFAULT_SEASON_BAG_TARGET` as well. The
 * default stops new documents from repeating it; this migration handles the
 * ones already written, because adding a default never touches stored data.
 *
 * Choice of value: the same target the admin cycle form starts from. A legacy
 * cycle predates the concept of a season goal, so there is no truer number to
 * recover — and a cycle showing the standard target is more useful to an admin
 * than one showing nothing. Run the audit afterwards to confirm none remain.
 *
 * Usage:
 *   pnpm migration:backfill-season-target            # Dry run (preview)
 *   pnpm migration:backfill-season-target:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION = 'votingcycles';
const FIELD = 'seasonBagTarget';

/**
 * Kept in step with the schema's own default. Not imported from it: migrations
 * describe the state of the data at the time they ran, and must keep behaving
 * the same after the schema moves on.
 */
const DEFAULT_SEASON_BAG_TARGET = 30000;

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

  const total = await collection.countDocuments();

  /*
   * Both shapes are broken in the same way for a reader. `$exists: false` is the
   * legacy document that predates the field; an explicit null is one written by
   * something that set the key without a value. Neither survives `.toFixed()`
   * or arithmetic, so both are in scope.
   */
  const filter = { $or: [{ [FIELD]: { $exists: false } }, { [FIELD]: null }] };
  const affected = await collection.countDocuments(filter);

  log(`Collection ${COLLECTION}: ${total} cycle(s) total.`);
  log(`Missing or null ${FIELD}: ${affected}`);

  if (affected === 0) {
    log('');
    log('Every cycle already carries a target. Nothing to do.');
    return;
  }

  const sample = await collection
    .find(filter, { projection: { name: 1, cycleNumber: 1, status: 1, createdAt: 1 } })
    .limit(10)
    .toArray();

  log('');
  log('Affected cycles (first 10):');
  for (const doc of sample) {
    log(
      `  #${String(doc['cycleNumber'] ?? '?')}  ${String(doc['name'] ?? 'unnamed')}  ` +
        `[${String(doc['status'] ?? 'unknown')}]`,
    );
  }

  if (dryRun) {
    log('');
    log('DRY RUN — would perform:');
    log(
      `  db.${COLLECTION}.updateMany(${JSON.stringify(filter)}, ` +
        `{ $set: { ${FIELD}: ${DEFAULT_SEASON_BAG_TARGET} } })`,
    );
    log('');
    log('Re-run with --execute to apply.');
    return;
  }

  log('');
  log(`Setting ${FIELD} = ${DEFAULT_SEASON_BAG_TARGET} on ${affected} cycle(s)...`);

  const result = await collection.updateMany(filter, {
    $set: { [FIELD]: DEFAULT_SEASON_BAG_TARGET },
  });

  log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);

  const remaining = await collection.countDocuments(filter);
  if (remaining > 0) {
    throw new Error(
      `${remaining} cycle(s) still lack ${FIELD} after the update. ` +
        'Investigate before assuming this migration succeeded.',
    );
  }

  log('Verified: no cycle is missing a target.');
}

run()
  .catch((err: unknown) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
