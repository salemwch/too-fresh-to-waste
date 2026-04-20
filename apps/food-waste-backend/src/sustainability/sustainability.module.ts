import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { SustainabilityController } from './controllers/sustainability.controller';
import { MerchantGoal, MerchantGoalSchema } from './schemas/merchant-goal.schema';
import { PdfReportService } from './services/pdf-report.service';
import { StreakService } from './services/streak.service';
import { SustainabilityService } from './services/sustainability.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: MerchantGoal.name, schema: MerchantGoalSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SustainabilityController],
  providers: [SustainabilityService, PdfReportService, StreakService],
  exports: [SustainabilityService, StreakService],
})
export class SustainabilityModule {}
