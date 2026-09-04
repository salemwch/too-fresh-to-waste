/**
 * =========================================
 * 🎯 PAYOUT LEDGER SUBTOTAL-SPLIT BACKFILL
 * =========================================
 *
 * Purpose: correct `MerchantPayoutLedger` rows written before the subtotal-split
 * fix, which still hold `merchantAmount`/`platformFee` computed from the order's
 * gross `total` (including delivery fee) instead of its food-only `subtotal`.
 *
 * The bug: `PayoutService.createLedgerEntry()` used to compute
 * `merchantAmount = round(orderTotal * 0.81)`, handing the merchant 81% of the
 * delivery fee on delivery orders — settlement must split `subtotal`, never
 * `total` (see `orders/utils/order-pricing.util.ts`'s header comment). Fixed in
 * the code; this migration corrects what was already written under the old
 * formula.
 *
 * Scope: `PENDING_SETTLEMENT` rows only. `PAID_OUT` rows represent money
 * already transferred — correcting those is a reconciliation/clawback decision,
 * not a data-correction one, and is explicitly out of scope here. `FAILED` rows
 * are left alone too; they re-enter `PENDING_SETTLEMENT` via the retry cron
 * unchanged, so a second pass after retry would catch them if still pending.
 *
 * Pickup orders are unaffected by design: `subtotal === total` when
 * `deliveryFee` is 0, so the old and new formulas agree and no correction is
 * written for them. Only delivery orders can differ.
 *
 * Missing orders: a ledger row whose `orderId` no longer resolves to an `Order`
 * document is logged and skipped, never guessed at — there is no subtotal to
 * recompute from.
 *
 * Usage:
 *   pnpm migration:backfill-ledger-subtotal-split            # Dry run (preview)
 *   pnpm migration:backfill-ledger-subtotal-split:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

import { calculateFoodRevenueSplit } from '../../src/orders/utils/order-pricing.util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const LEDGER_COLLECTION = 'merchantpayoutledgers';
const ORDER_COLLECTION = 'orders';
const PENDING_SETTLEMENT = 'pending_settlement';

const dryRun = !process.argv.includes('--execute');

const log = (msg: string): void => {
  console.log(msg);
};

interface LedgerRow {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  merchantAmount: number;
  platformFee: number;
}

interface OrderPricingDoc {
  _id: mongoose.Types.ObjectId;
  pricing?: { subtotal?: number };
}

interface Correction {
  ledgerId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  oldMerchantAmount: number;
  newMerchantAmount: number;
  oldPlatformFee: number;
  newPlatformFee: number;
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
  const ledgerCollection = db.collection<LedgerRow>(LEDGER_COLLECTION);
  const orderCollection = db.collection<OrderPricingDoc>(ORDER_COLLECTION);

  const pendingRows = await ledgerCollection
    .find({ status: PENDING_SETTLEMENT })
    .project<LedgerRow>({ orderId: 1, merchantAmount: 1, platformFee: 1 })
    .toArray();

  log(`Ledger rows with status "${PENDING_SETTLEMENT}": ${pendingRows.length}`);

  const corrections: Correction[] = [];
  const missingOrders: mongoose.Types.ObjectId[] = [];

  for (const row of pendingRows) {
    const order = await orderCollection.findOne(
      { _id: row.orderId },
      { projection: { 'pricing.subtotal': 1 } },
    );

    if (!order?.pricing?.subtotal && order?.pricing?.subtotal !== 0) {
      missingOrders.push(row.orderId);
      continue;
    }

    const { merchantAmount, platformFee } = calculateFoodRevenueSplit(order.pricing.subtotal);

    // Pickup orders (subtotal === total) already agree with the old formula —
    // only rows that actually differ are corrections.
    if (merchantAmount === row.merchantAmount && platformFee === row.platformFee) {
      continue;
    }

    corrections.push({
      ledgerId: row._id,
      orderId: row.orderId,
      oldMerchantAmount: row.merchantAmount,
      newMerchantAmount: merchantAmount,
      oldPlatformFee: row.platformFee,
      newPlatformFee: platformFee,
    });
  }

  log(`Rows needing correction: ${corrections.length}`);
  if (missingOrders.length > 0) {
    log(
      `Skipped (order not found, needs manual review): ${missingOrders.length} — ` +
        missingOrders.map(id => id.toString()).join(', '),
    );
  }

  if (corrections.length === 0) {
    log('');
    log('Nothing to correct.');
    return;
  }

  log('');
  log('Corrections (first 10):');
  for (const c of corrections.slice(0, 10)) {
    log(
      `  ledger ${c.ledgerId.toString()} (order ${c.orderId.toString()}): ` +
        `merchantAmount ${c.oldMerchantAmount} -> ${c.newMerchantAmount}, ` +
        `platformFee ${c.oldPlatformFee} -> ${c.newPlatformFee}`,
    );
  }

  if (dryRun) {
    log('');
    log(`DRY RUN — would update ${corrections.length} row(s).`);
    log('Re-run with --execute to apply.');
    return;
  }

  log('');
  log(`Applying ${corrections.length} correction(s)...`);

  const bulkOps = corrections.map(c => ({
    updateOne: {
      filter: { _id: c.ledgerId, status: PENDING_SETTLEMENT },
      update: {
        $set: { merchantAmount: c.newMerchantAmount, platformFee: c.newPlatformFee },
      },
    },
  }));

  const result = await ledgerCollection.bulkWrite(bulkOps);
  log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);

  if (result.modifiedCount !== corrections.length) {
    throw new Error(
      `Expected to modify ${corrections.length} row(s) but modified ${result.modifiedCount}. ` +
        'A row may have left PENDING_SETTLEMENT (e.g. paid out) between the read and the write ' +
        '— investigate before assuming this migration succeeded.',
    );
  }

  log('Verified: modified count matches the correction set.');
}

run()
  .catch((err: unknown) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
