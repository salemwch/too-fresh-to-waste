/**
 * =========================================
 * 🗓️  SUBSCRIPTION EXPIRY BACKFILL
 * =========================================
 *
 * Purpose: give every paid establishment an end date, so the daily scan can see
 * it. Read the code fix first — this repairs data, it does not prevent the bug.
 *
 * The bug: the admin `markAsPaid` path set `subscriptionStatus = 'paid'` and
 * nothing else. The daily scan selects
 * `{ subscriptionStatus: 'paid', subscriptionExpiresAt: { $lt: now } }`, and a
 * missing field never satisfies `$lt`, so those merchants were subscribed for
 * life. Its own docblock said so out loud — "excluded from the daily expiry scan
 * forever" — which is why this went unnoticed: it read as a decision rather than
 * a defect. At the time of writing, **both** paid establishments in production
 * were in that state, neither having ever paid through Konnect.
 *
 * What it writes: a fresh period from *now*, not from whenever the grant was
 * made. Backdating would suspend, on the next nightly scan, merchants who
 * believe they are paid — a billing dispute created by a repair script. Starting
 * now is the conservative direction: at worst a merchant gets a few extra days.
 *
 * `monthly` unless the document already says otherwise. It is the shorter grant,
 * so a guess cannot hand out a free year.
 *
 * RUN THIS BEFORE DEPLOYING the trial-expiry change. That scan now also matches
 * a missing expiry; ship it against un-backfilled data and it suspends every
 * paid merchant on the next run.
 *
 * Usage:
 *   pnpm migration:backfill-subscription-expiry            # Dry run (preview)
 *   pnpm migration:backfill-subscription-expiry:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

import { nextSubscriptionExpiry, toSubscriptionCycle } from '../../src/subscription/subscription-period';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION = 'establishments';

const dryRun = !process.argv.includes('--execute');

const log = (msg: string): void => {
  console.log(msg);
};

interface EstablishmentRow {
  _id: mongoose.Types.ObjectId;
  name?: string;
  subscriptionTier?: string;
  subscriptionCycle?: string;
}

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
  const collection = db.collection<EstablishmentRow>(COLLECTION);

  // `null` matches a missing key as well as an explicit null — both are
  // unreadable end dates, and both were invisible to the scan.
  const filter = { subscriptionStatus: 'paid', subscriptionExpiresAt: null };

  const affected = await collection.find(filter).toArray();
  const totalPaid = await collection.countDocuments({ subscriptionStatus: 'paid' });

  log(`Paid establishments: ${totalPaid}`);
  log(`Missing an expiry date: ${affected.length}`);

  if (affected.length === 0) {
    log('');
    log('Every paid subscription already has an end date. Nothing to do.');
    return;
  }

  const now = new Date();

  const planned = affected.map(doc => {
    const cycle = toSubscriptionCycle(doc.subscriptionCycle);
    return { doc, cycle, expiresAt: nextSubscriptionExpiry(cycle, undefined, now) };
  });

  log('');
  log('Would grant:');
  for (const { doc, cycle, expiresAt } of planned) {
    log(
      `  ${doc._id.toString()}  ${(doc.name ?? 'unnamed').slice(0, 34).padEnd(36)}` +
        `tier=${doc.subscriptionTier ?? 'standard'}  cycle=${cycle}  → ${expiresAt.toISOString()}`,
    );
  }

  if (dryRun) {
    log('');
    log('DRY RUN — re-run with --execute to apply.');
    return;
  }

  log('');
  let modified = 0;
  for (const { doc, cycle, expiresAt } of planned) {
    /*
     * One update per document rather than a single updateMany: each gets its own
     * date derived from its own cycle, and the filter is repeated so a
     * subscription that gained an expiry between the read and the write — a real
     * payment landing mid-run — is left alone rather than overwritten.
     */
    const result = await collection.updateOne(
      { _id: doc._id, subscriptionExpiresAt: null },
      { $set: { subscriptionExpiresAt: expiresAt, subscriptionCycle: cycle } },
    );
    modified += result.modifiedCount;
  }

  log(`Updated ${modified} of ${planned.length}.`);

  const remaining = await collection.countDocuments(filter);
  if (remaining > 0) {
    throw new Error(
      `${remaining} paid establishment(s) still have no expiry. ` +
        'Do not deploy the trial-expiry change until this reports zero.',
    );
  }

  log('Verified: every paid subscription now has an end date.');
}

run()
  .catch((err: unknown) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
