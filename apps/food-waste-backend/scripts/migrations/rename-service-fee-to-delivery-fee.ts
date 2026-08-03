/**
 * =========================================
 * 💸 pricing.serviceFee → pricing.deliveryFee
 * =========================================
 *
 * Purpose: rename the field on orders already written, so historical orders
 * keep rendering a fee breakdown after the schema rename.
 *
 * ## Why the rename happened
 *
 * `serviceFee` was a hardcoded 4 TND charged whenever
 * `paymentMethod === 'pay_on_delivery'` — in **both** delivery and pickup. The
 * fee tracked how the customer paid rather than whether anything was
 * delivered, which produced two wrong outcomes:
 *
 *   - a **pickup** order paid in cash was charged 4 TND, and
 *   - a **delivery** order paid online was charged nothing, while the driver
 *     still accrued 3 TND that the platform funded from its own margin.
 *
 * The fee now depends only on `deliveryMode`.
 *
 * ## What this migration deliberately does NOT do
 *
 * It does not recompute `total`, and it does not zero the fee on historical
 * pickup orders. Those customers really were charged that amount; rewriting it
 * would make the stored order disagree with the payment the customer actually
 * made and with the merchant settlement already recorded against it. A
 * financial record states what happened, not what the current rules would have
 * produced.
 *
 * So for legacy **pickup** orders the renamed `deliveryFee` holds what was then
 * a cash surcharge. That is a labelling imprecision on historical rows only,
 * and it is the honest trade against falsifying `total`. New orders cannot
 * reach that state: pickup now yields `deliveryFee: 0`.
 *
 * Usage:
 *   pnpm migration:rename-service-fee            # Dry run (preview)
 *   pnpm migration:rename-service-fee:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION = 'orders';
const OLD_FIELD = 'pricing.serviceFee';
const NEW_FIELD = 'pricing.deliveryFee';

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
  const filter = { [OLD_FIELD]: { $exists: true } };
  const affected = await collection.countDocuments(filter);

  // Breakdown, so the operator can see what the rename is about to relabel.
  const nonZero = await collection.countDocuments({ [OLD_FIELD]: { $gt: 0 } });
  const pickupWithFee = await collection.countDocuments({
    [OLD_FIELD]: { $gt: 0 },
    deliveryMode: { $ne: 'delivery' },
  });
  const deliveryWithoutFee = await collection.countDocuments({
    deliveryMode: 'delivery',
    $or: [{ [OLD_FIELD]: { $lte: 0 } }, { [OLD_FIELD]: { $exists: false } }],
  });

  log(`Collection ${COLLECTION}: ${total} order(s) total.`);
  log(`Carrying "${OLD_FIELD}": ${affected}`);
  log(`…of which non-zero: ${nonZero}`);
  log('');
  log('Legacy model artefacts (informational — NOT corrected by this script):');
  log(`  pickup orders charged a fee:            ${pickupWithFee}`);
  log(`  delivery orders charged NO fee:         ${deliveryWithoutFee}`);
  if (deliveryWithoutFee > 0) {
    log('');
    log(`  ⚠ Those ${deliveryWithoutFee} delivery order(s) each accrued driver`);
    log('    earnings the platform funded itself. They are the historical cost');
    log('    of the bug; the code change stops it recurring.');
  }

  if (affected === 0) {
    log('');
    log('No order carries the legacy field. Nothing to do.');
    return;
  }

  if (dryRun) {
    log('');
    log('DRY RUN — would perform:');
    log(
      `  db.${COLLECTION}.updateMany(${JSON.stringify(filter)}, ` +
        `{ $rename: { "${OLD_FIELD}": "${NEW_FIELD}" } })`,
    );
    log('');
    log('Re-run with --execute to apply.');
    return;
  }

  log('');
  log(`Renaming "${OLD_FIELD}" → "${NEW_FIELD}" on ${affected} order(s)…`);

  // $rename preserves the value and leaves every other field untouched, so
  // `total` and the settlement records stay exactly as they were.
  const result = await collection.updateMany(filter, {
    $rename: { [OLD_FIELD]: NEW_FIELD },
  });

  log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);

  const remaining = await collection.countDocuments(filter);
  if (remaining > 0) {
    throw new Error(`${remaining} order(s) still carry "${OLD_FIELD}" after the rename.`);
  }

  log('');
  log(`Done. No order contains "${OLD_FIELD}" any more.`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('Migration failed:', error instanceof Error ? error.message : String(error));
    await mongoose.disconnect();
    process.exit(1);
  });
