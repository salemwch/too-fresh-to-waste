/**
 * One-time migration: restore orders wrongly overwritten to EXPIRED by the
 * expiry cron after pickup was already confirmed.
 *
 * Root cause: updateExpiredOrders() used `status: { $ne: EXPIRED }` which
 * also matched PICKED_UP orders once their expiresAt passed. This caused:
 *   1. status PICKED_UP → EXPIRED  (hides orders from carbon/impact reports)
 *   2. reservedQuantity decremented a second time (inventory corruption)
 *   3. cancellationReason set to 'Order expired automatically' (false)
 *
 * Filter: status=EXPIRED + paymentStatus=PAID is unambiguous because we use
 * cash-only payments (cash_on_pickup / pay_on_delivery). paymentStatus is set
 * to PAID only at pickup code confirmation — at the same moment status becomes
 * PICKED_UP. So PAID + EXPIRED can only mean the cron corrupted the record.
 *
 * Run once:
 *   pnpm --filter @foodwaste/backend ts-node -r tsconfig-paths/register \
 *     src/seeds/fix-wrongly-expired-orders.ts
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';

import { AppModule } from '../app.module';
import { AppLoggerService } from '../common/services/logger.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import { OrderItem } from '../orders/schemas/order.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const orderModel = app.get<Model<OrderDocument>>(getModelToken(Order.name));
  const offerModel = app.get<Model<OfferDocument>>(getModelToken(Offer.name));
  const logger = new AppLoggerService();

  logger.log('Starting migration: fix wrongly expired orders…', 'Migration');

  const affected = await orderModel
    .find({
      status: OrderStatus.EXPIRED,
      paymentStatus: PaymentStatus.PAID,
    })
    .select('_id orderNumber items')
    .lean()
    .exec();

  logger.log(`Found ${affected.length} wrongly expired order(s)`, 'Migration');

  if (affected.length === 0) {
    logger.log('Nothing to fix. Exiting.', 'Migration');
    await app.close();
    return;
  }

  let fixed = 0;
  let inventoryFixed = 0;
  const errors: string[] = [];

  for (const order of affected) {
    try {
      // 1. Restore order status and remove the false cancellation reason
      await orderModel.findByIdAndUpdate(order._id, {
        $set: { status: OrderStatus.PICKED_UP },
        $unset: { cancellationReason: '' },
      });

      // 2. Undo the erroneous reservedQuantity decrement.
      //    confirmPickup:  reservedQuantity -= qty, soldQuantity += qty  ✅
      //    expiry cron:    reservedQuantity -= qty (wrong — already done) ❌
      //    Fix:            reservedQuantity += qty  (cancel the bad decrement)
      for (const item of order.items as OrderItem[]) {
        await offerModel.findByIdAndUpdate(item.offerId, {
          $inc: { reservedQuantity: item.quantity },
        });
        inventoryFixed++;
      }

      fixed++;
      logger.log(`Fixed order ${order.orderNumber} (${String(order._id)})`, 'Migration');
    } catch (err) {
      const msg = `Failed on order ${String(order._id)}: ${(err as Error).message}`;
      logger.error(msg, 'Migration');
      errors.push(msg);
    }
  }

  logger.log(
    `Done — ${fixed}/${affected.length} orders restored, ` +
      `${inventoryFixed} offer inventory entries corrected, ` +
      `${errors.length} error(s).`,
    'Migration',
  );

  if (errors.length) {
    logger.error(`Errors:\n${errors.join('\n')}`, 'Migration');
  }

  await app.close();
}

bootstrap().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
