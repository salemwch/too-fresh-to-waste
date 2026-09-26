/**
 * =========================================
 * 💳 Backfill order.paymentControl (+ legacy order.commission)
 * =========================================
 *
 * The commission-settlement model reads WHO HOLDS THE CUSTOMER'S MONEY from
 * `order.paymentControl`, written at creation and never re-derived
 * (`.claude/work/commission-settlement-model.md`). Orders created before that
 * field existed need it once, from their own stored method and fulfilment.
 *
 * Phase 1 - paymentControl, via `legacyPaymentControl` (tested in
 *   `orders/__tests__/legacy-payment-control.util.spec.ts`). Orders whose
 *   method nothing ever collected are left untouched and listed.
 *
 * Phase 2 - order.commission for orders the PRE-CUTOFF engine already applied
 *   (they have commission_ledger rows). Copied from those rows with
 *   `model: 'LEGACY'`. This DESCRIBES money that already moved; it writes no
 *   ledger row and changes no balance. Orders with no ledger rows get nothing:
 *   no retroactive commission, by decision of the product owner.
 *
 * Idempotent: every write is conditional on the field being absent.
 *
 * Usage:
 *   pnpm migration:backfill-payment-control            # Dry run (preview)
 *   pnpm migration:backfill-payment-control:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

import { legacyPaymentControl } from '../../src/orders/utils/legacy-payment-control.util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dryRun = !process.argv.includes('--execute');
const BATCH = 500;
const SAMPLE = 20;

const log = (msg: string): void => {
  console.log(msg);
};

const round3 = (value: number): number => parseFloat(value.toFixed(3));

interface LedgerRow {
  type: 'accrual' | 'settlement';
  amount: number;
  balanceAfter: number;
  merchantAmount?: number;
  createdAt: Date;
}

async function backfillPaymentControl(orders: mongoose.mongo.Collection): Promise<void> {
  const cursor = orders.find(
    { paymentControl: { $exists: false } },
    { projection: { 'paymentDetails.method': 1, deliveryMode: 1, paymentProvider: 1 } },
  );

  const byClass = new Map<string, number>();
  const anomalies = new Map<string, string[]>();
  const unclassified: string[] = [];
  let ops: mongoose.mongo.AnyBulkWriteOperation[] = [];
  let written = 0;

  const flush = async (): Promise<void> => {
    if (ops.length === 0) return;
    if (!dryRun) {
      const result = await orders.bulkWrite(ops, { ordered: false });
      written += result.modifiedCount;
    }
    ops = [];
  };

  for await (const doc of cursor) {
    const result = legacyPaymentControl({
      method: (doc['paymentDetails'] as { method?: string } | undefined)?.method,
      deliveryMode: doc['deliveryMode'] as 'pickup' | 'delivery' | undefined,
      paymentProvider: doc['paymentProvider'] as string | undefined,
    });
    const id = String(doc['_id']);

    if (result.anomaly) {
      const list = anomalies.get(result.anomaly) ?? [];
      if (list.length < SAMPLE) list.push(id);
      anomalies.set(result.anomaly, list);
    }
    if (result.control === null) {
      if (unclassified.length < SAMPLE) unclassified.push(id);
      byClass.set('UNCLASSIFIED', (byClass.get('UNCLASSIFIED') ?? 0) + 1);
      continue;
    }

    const key = `${result.control.controlledBy}/${result.control.collector}`;
    byClass.set(key, (byClass.get(key) ?? 0) + 1);
    ops.push({
      updateOne: {
        filter: { _id: doc['_id'], paymentControl: { $exists: false } },
        update: { $set: { paymentControl: result.control } },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();

  log('\nPhase 1 - paymentControl');
  for (const [key, count] of [...byClass.entries()].sort()) {
    log(`  ${key.padEnd(26)} ${count}`);
  }
  for (const [anomaly, ids] of anomalies) {
    log(`  anomaly: ${anomaly}  (sample: ${ids.join(', ')})`);
  }
  if (unclassified.length > 0) {
    log(`  left without a control, for a human decision: ${unclassified.join(', ')}`);
  }
  log(dryRun ? '  (dry run - nothing written)' : `  written: ${written}`);
}

async function backfillLegacyCommission(
  orders: mongoose.mongo.Collection,
  ledger: mongoose.mongo.Collection,
): Promise<void> {
  const grouped = ledger.aggregate<{ _id: mongoose.Types.ObjectId; rows: LedgerRow[] }>([
    { $match: { orderId: { $exists: true }, type: { $in: ['accrual', 'settlement'] } } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$orderId',
        rows: {
          $push: {
            type: '$type',
            amount: '$amount',
            balanceAfter: '$balanceAfter',
            merchantAmount: '$merchantAmount',
            createdAt: '$createdAt',
          },
        },
      },
    },
  ]);

  let candidates = 0;
  let written = 0;
  let ops: mongoose.mongo.AnyBulkWriteOperation[] = [];

  const flush = async (): Promise<void> => {
    if (ops.length === 0) return;
    if (!dryRun) {
      const result = await orders.bulkWrite(ops, { ordered: false });
      written += result.modifiedCount;
    }
    ops = [];
  };

  for await (const group of grouped) {
    const accrual = group.rows.find(r => r.type === 'accrual');
    const settlement = group.rows.find(r => r.type === 'settlement');
    if (!accrual) continue; // the legacy engine always wrote the accrual
    candidates++;

    const settled = settlement?.amount ?? 0;
    ops.push({
      updateOne: {
        filter: { _id: group._id, commission: { $exists: false } },
        update: {
          $set: {
            commission: {
              model: 'LEGACY',
              kind: settled > 0 ? 'SETTLEMENT' : 'NORMAL',
              controlledBy: 'TFTW', // the legacy engine only ran for online payments
              accrued: accrual.amount,
              settled,
              merchantAmount: accrual.merchantAmount ?? 0,
              dueBefore: round3(accrual.balanceAfter - accrual.amount),
              dueAfter: settlement?.balanceAfter ?? accrual.balanceAfter,
              appliedAt: accrual.createdAt,
            },
          },
        },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();

  log('\nPhase 2 - legacy order.commission (from existing ledger rows only)');
  log(`  orders with legacy ledger rows: ${candidates}`);
  log(dryRun ? '  (dry run - nothing written)' : `  written: ${written}`);
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

  log(dryRun ? 'DRY RUN - pass --execute to write.' : 'EXECUTING.');
  await backfillPaymentControl(db.collection('orders'));
  await backfillLegacyCommission(db.collection('orders'), db.collection('commission_ledger'));

  await mongoose.disconnect();
}

run().catch(async (error: unknown) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
