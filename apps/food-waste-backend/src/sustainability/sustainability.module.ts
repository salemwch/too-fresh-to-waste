import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Order, OrderSchema } from '../orders/schemas/order.schema';

import { SustainabilityController } from './controllers/sustainability.controller';
import { MerchantGoal, MerchantGoalSchema } from './schemas/merchant-goal.schema';
import { PdfReportService } from './services/pdf-report.service';
import { SustainabilityService } from './services/sustainability.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: MerchantGoal.name, schema: MerchantGoalSchema },
    ]),
  ],
  controllers: [SustainabilityController],
  providers: [SustainabilityService, PdfReportService],
  exports: [SustainabilityService],
})
export class SustainabilityModule {}
