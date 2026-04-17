import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommunityGoalModule } from '../community-goal/community-goal.module';
import { DonationsModule } from '../donations/donations.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

import { OrderEventsListener } from './listeners/order-events.listener';
import { UserEventsListener } from './listeners/user-events.listener';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyAccount, LoyaltyAccountSchema } from './schemas/loyalty-account.schema';
import { ReferredIdentity, ReferredIdentitySchema } from './schemas/referred-identity.schema';
import { GamificationService } from './services/gamification.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: ReferredIdentity.name, schema: ReferredIdentitySchema },
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
