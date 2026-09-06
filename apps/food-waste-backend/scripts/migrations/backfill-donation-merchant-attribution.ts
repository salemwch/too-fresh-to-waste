/**
 * =========================================
 * 💚 DONATION MERCHANT ATTRIBUTION BACKFILL
 * =========================================
 *
 * Purpose: give every historical UserDonation the merchantId and
 * establishmentId of the order that produced it, so the merchant fund ledger
 * shows real history on launch day rather than zero.
 *
 * Why it is a release gate: the ledger aggregates on merchantId. Without this,
 * every merchant who joined before the feature sees 0.000 TND and reads the
 * card as broken. A first impression of "broken" is not recoverable by running
 * the migration a week later.
 *
 * What it does NOT backfill: goalCategoryAtContribution. The pool rotates its
 * active goal in place, so the category a historical donation funded is not
 * recoverable from current state. Those donations contribute to the TND total
 * and are excluded from the item breakdown, which toFundedItems already handles
 * by ignoring the null group.
 *
 * Idempotent: only touches documents missing merchantId. Re-running is a no-op.
 *
 * Usage:
 *   pnpm migration:backfill-donation-attribution            # Dry run (preview)
 *   pnpm migration:backfill-donation-attribution:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DONATIONS = 'userdonations';
const ORDERS = 'orders';
const BATCH_SIZE = 500;

const dryRun = !process.argv.includes('--execute');

const log = (msg: string): void => {
  console.log(msg);
};

interface DonationRow {
  _id: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  merchantId?: mongoose.Types.ObjectId;
}

interface OrderRow {
  _id: mongoose.Types.ObjectId;
  merchantId?: mongoose.Types.ObjectId;
  establishmentId?: mongoose.Types.ObjectId;
}

async function run(): Promise<void> {
  const uri = process.env['DATABASE_URL'];
  if (!uri) {
    throw new Error(
      'DATABASE_URL is not set. Configure .env before running this migration.',
    );
  }

  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('No database handle after connecting.');
  }

  const donations = db.collection<DonationRow>(DONATIONS);
  const orders = db.collection<OrderRow>(ORDERS);

  const pending = await donations
    .find({ merchantId: { $exists: false } })
    .toArray();
  log(`${pending.length} donation(s) without merchant attribution`);

  if (pending.length === 0) {
    log('Nothing to do.');
    await conn.disconnect();
    return;
  }

  let updated = 0;
  let orphaned = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const orderIds = batch
      .map(d => d.orderId)
      .filter((id): id is mongoose.Types.ObjectId => !!id);

    // Batched $in read plus a Map, never one findById per donation.
    const orderDocs = await orders
      .find({ _id: { $in: orderIds } })
      .project<OrderRow>({ merchantId: 1, establishmentId: 1 })
      .toArray();
    const byId = new Map(orderDocs.map(o => [o._id.toString(), o]));

    const ops = [];
    for (const donation of batch) {
      const order = donation.orderId
        ? byId.get(donation.orderId.toString())
        : undefined;
      if (!order?.merchantId) {
        orphaned += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: donation._id },
          update: {
            $set: {
              merchantId: order.merchantId,
              ...(order.establishmentId
                ? { establishmentId: order.establishmentId }
                : {}),
            },
          },
        },
      });
    }

    if (ops.length > 0) {
      if (dryRun) {
        updated += ops.length;
      } else {
        const result = await donations.bulkWrite(ops);
        updated += result.modifiedCount;
      }
    }
  }

  log('');
  log(dryRun ? '--- DRY RUN, nothing written ---' : '--- EXECUTED ---');
  log(`attributed: ${updated}`);
  log(
    `orphaned (order missing or has no merchantId, left untouched): ${orphaned}`,
  );
  if (dryRun) {
    log('Re-run with --execute to write.');
  }

  await conn.disconnect();
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
