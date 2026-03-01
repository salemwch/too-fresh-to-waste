import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { GamificationService } from './services/gamification.service';
import { UserEventsListener } from './listeners/user-events.listener';
import { OrderEventsListener } from './listeners/order-events.listener';
import { LoyaltyAccount, LoyaltyAccountSchema } from './schemas/loyalty-account.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { DonationsModule } from '../donations/donations.module';
import { CommunityGoalModule } from '../community-goal/community-goal.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    forwardRef(() => DonationsModule),
    CommunityGoalModule,
  ],
  controllers: [LoyaltyController],
  providers: [
    LoyaltyService,
    GamificationService,
    UserEventsListener, // Event listener for user-related events
    OrderEventsListener, // Event listener for order-related events
  ],
  exports: [LoyaltyService, GamificationService, MongooseModule],
})
export class LoyaltyModule {}
