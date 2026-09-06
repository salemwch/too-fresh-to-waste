import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { ProSubscriptionGuard } from '../common/guards/pro-subscription.guard';
import { UserDonation, UserDonationSchema } from '../donations/schemas/user-donation.schema';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { SustainabilityController } from './controllers/sustainability.controller';
import { MerchantGoal, MerchantGoalSchema } from './schemas/merchant-goal.schema';
import { FundLedgerService } from './services/fund-ledger.service';
import { PdfReportService } from './services/pdf-report.service';
import { StreakService } from './services/streak.service';
import { SustainabilityService } from './services/sustainability.service';

@Module({
  imports: [
    // StreakService injects CronLockService, which CommonModule provides and
    // exports. CommonModule is not @Global, so it has to be imported here.
    CommonModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: MerchantGoal.name, schema: MerchantGoalSchema },
      { name: User.name, schema: UserSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      // Registered here (not imported via DonationsModule) so FundLedgerService
      // can read UserDonation directly without pulling in the donations
      // module's Bull queue and listeners.
      { name: UserDonation.name, schema: UserDonationSchema },
    ]),
  ],
  controllers: [SustainabilityController],
  providers: [
    SustainabilityService,
    PdfReportService,
    StreakService,
    ProSubscriptionGuard,
    FundLedgerService,
  ],
  exports: [SustainabilityService, StreakService, FundLedgerService],
})
export class SustainabilityModule {}
