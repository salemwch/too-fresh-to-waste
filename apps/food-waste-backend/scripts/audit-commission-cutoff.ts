/**
 * Commission cutoff audit - READ-ONLY.
 *
 * Reports, for `COMMISSION_MODEL_EFFECTIVE_AT`:
 *   - the exact effective instant, in UTC and in Africa/Tunis;
 *   - historical completed orders EXCLUDED from the new model (no commission
 *     was ever applied to them): count and summed subtotal, by controlledBy and
 *     by fulfilment;
 *   - historical orders the pre-cutoff engine DID apply (online pickups);
 *   - orders whose commission moment is at or after the cutoff but that have
 *     no `order.commission` - must be 0. Any other value is a defect, and the
 *     script exits 1.
 *
 * Excluded + old-model + post-cutoff reconcile to every completed order.
 *
 * The commission moment is the one the model uses: `driverPickedUpAt` for a
 * delivery (the driver collecting from the merchant), the pickup time for a
 * pickup (`pickedUpAt`, falling back to `pickupDetails.actualPickupTime`,
 * which is all that orders confirmed before `pickedUpAt` was written carry).
 *
 * Usage:
 *   pnpm audit:commission-cutoff
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

import { parseCommissionCutoff } from '../src/config/commission-cutoff.util';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COMPLETED = ['picked_up', 'completed', 'delivered'];

interface Bucket {
  _id: { phase: 'BEFORE' | 'AFTER'; applied: boolean; controlledBy: string; mode: string };
  orders: number;
  subtotal: number;
}

const round3 = (value: number): number => parseFloat(value.toFixed(3));

async function run(): Promise<void> {
  const raw = process.env['COMMISSION_MODEL_EFFECTIVE_AT'];
  const cutoff = parseCommissionCutoff(raw);
  if (!cutoff) {
    throw new Error(
      `COMMISSION_MODEL_EFFECTIVE_AT is ${raw ? `invalid ("${raw}")` : 'not set'}. ` +
        'Set it to the release instant, e.g. YYYY-MM-DDTHH:mm:ss+01:00.',
    );
  }

  const uri = process.env['DATABASE_URL'];
  if (!uri) {
    throw new Error('DATABASE_URL is not set.');
  }
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('No database handle after connecting.');
  }

  const buckets = await db
    .collection('orders')
    .aggregate<Bucket>([
      { $match: { status: { $in: COMPLETED }, isDeleted: { $ne: true } } },
      {
        $addFields: {
          _moment: {
            $cond: [
              { $eq: ['$deliveryMode', 'delivery'] },
              '$driverPickedUpAt',
              { $ifNull: ['$pickedUpAt', '$pickupDetails.actualPickupTime'] },
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            phase: { $cond: [{ $gte: ['$_moment', cutoff] }, 'AFTER', 'BEFORE'] },
            applied: { $gt: ['$commission', null] },
            controlledBy: { $ifNull: ['$paymentControl.controlledBy', 'UNKNOWN'] },
            mode: { $ifNull: ['$deliveryMode', 'pickup'] },
          },
          orders: { $sum: 1 },
          subtotal: { $sum: { $ifNull: ['$pricing.subtotal', 0] } },
        },
      },
      { $sort: { '_id.phase': 1, '_id.applied': 1, '_id.controlledBy': 1, '_id.mode': 1 } },
    ])
    .toArray();

  const pick = (phase: 'BEFORE' | 'AFTER', applied: boolean) =>
    buckets.filter(b => b._id.phase === phase && b._id.applied === applied);
  const total = (rows: Bucket[]) => ({
    orders: rows.reduce((s, r) => s + r.orders, 0),
    subtotal: round3(rows.reduce((s, r) => s + r.subtotal, 0)),
  });
  const print = (title: string, rows: Bucket[]) => {
    const t = total(rows);
    console.log(`\n${title}: ${t.orders} orders, ${t.subtotal.toFixed(3)} TND`);
    for (const r of rows) {
      console.log(
        `  ${r._id.controlledBy.padEnd(9)} ${r._id.mode.padEnd(9)} ${String(r.orders).padStart(7)}  ${round3(r.subtotal).toFixed(3)} TND`,
      );
    }
  };

  console.log('Commission model effective at');
  console.log(`  UTC           ${cutoff.toISOString()}`);
  console.log(`  Africa/Tunis  ${cutoff.toLocaleString('en-GB', { timeZone: 'Africa/Tunis' })}`);

  print(
    'Historical, EXCLUDED from the new model (no commission ever applied)',
    pick('BEFORE', false),
  );
  print('Historical, applied by the pre-cutoff engine', pick('BEFORE', true));
  print('At or after the cutoff, applied', pick('AFTER', true));
  const missing = pick('AFTER', false);
  print('At or after the cutoff, MISSING order.commission (must be 0)', missing);

  const all = total(buckets);
  console.log(
    `\nAll completed orders: ${all.orders} (${all.subtotal.toFixed(3)} TND) - the four groups above sum to this.`,
  );

  await mongoose.disconnect();

  if (total(missing).orders > 0) {
    console.error('\nDEFECT: completed orders after the cutoff have no commission decision.');
    process.exit(1);
  }
}

run().catch(async (error: unknown) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
