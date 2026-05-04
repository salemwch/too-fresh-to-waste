/**
 * Standalone migration — no NestJS, no RabbitMQ.
 * Restores orders wrongly overwritten to EXPIRED by the expiry cron
 * after pickup was already confirmed (paymentStatus = 'paid').
 *
 * Run: node scripts/migrations/fix-wrongly-expired-orders.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI =
  process.env.DATABASE_URL ||
  'mongodb+srv://foodwaste_user:a3yoNUPRgksQvUnZ@cluster0.61uimdv.mongodb.net/toofreshtowaste?retryWrites=true&w=majority&appName=Cluster0&compressors=none';

async function run() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const orders = db.collection('orders');
    const offers = db.collection('offers');

    // Find all orders that were completed (paymentStatus=paid) but wrongly
    // overwritten to EXPIRED by the expiry cron.
    const affected = await orders
      .find(
        { status: 'expired', paymentStatus: 'paid' },
        { projection: { _id: 1, orderNumber: 1, items: 1 } },
      )
      .toArray();

    console.log(`Found ${affected.length} wrongly expired order(s)`);

    if (affected.length === 0) {
      console.log('Nothing to fix.');
      return;
    }

    let fixed = 0;
    let inventoryFixed = 0;
    const errors = [];

    for (const order of affected) {
      try {
        // 1. Restore status, remove false cancellationReason
        await orders.updateOne(
          { _id: order._id },
          {
            $set: { status: 'picked_up' },
            $unset: { cancellationReason: '' },
          },
        );

        // 2. Undo the double-decrement of reservedQuantity.
        //    confirmPickup already did: reservedQuantity -= qty ✅
        //    Then the cron wrongly did: reservedQuantity -= qty again ❌
        //    Fix: reservedQuantity += qty
        for (const item of order.items || []) {
          await offers.updateOne(
            { _id: item.offerId },
            { $inc: { reservedQuantity: item.quantity } },
          );
          inventoryFixed++;
        }

        fixed++;
        console.log(`  ✓ Fixed order ${order.orderNumber} (${order._id})`);
      } catch (err) {
        const msg = `  ✗ Failed on order ${order._id}: ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    console.log(
      `\nDone — ${fixed}/${affected.length} orders restored, ` +
        `${inventoryFixed} offer inventory entries corrected, ` +
        `${errors.length} error(s).`,
    );

    if (errors.length) {
      console.error('\nErrors:\n' + errors.join('\n'));
    }
  } finally {
    await client.close();
    console.log('Disconnected.');
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
