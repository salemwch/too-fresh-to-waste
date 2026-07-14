import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ProSubscriptionGuard } from '../common/guards/pro-subscription.guard';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
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
      { name: Establishment.name, schema: EstablishmentSchema },
    ]),
  ],
  controllers: [SustainabilityController],
  providers: [SustainabilityService, PdfReportService, StreakService, ProSubscriptionGuard],
  exports: [SustainabilityService, StreakService],
})
export class SustainabilityModule {}
