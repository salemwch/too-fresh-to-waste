import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { MerchantSalesService } from './merchant-sales.service';

/**
 * Imported by Orders, Payments and Analytics; depends on neither of them.
 * Not registered in AppModule yet - later tasks import it where needed.
 */
@Module({
  imports: [CommonModule, MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }])],
  providers: [MerchantSalesService],
  exports: [MerchantSalesService],
})
export class MerchantSalesModule {}
