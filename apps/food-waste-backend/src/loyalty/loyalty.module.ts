import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { MonthlyBagGoalModule } from '../community-goal/community-goal.module';
import { VotingCycle, VotingCycleSchema } from '../voting/schemas/voting-cycle.schema';

import {
  MonthlyBagGoal,
  MonthlyBagGoalSchema,
} from '../community-goal/schemas/community-bag-goal.schema';
import { DonationsModule } from '../donations/donations.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { VotingModule } from '../voting/voting.module';

import { AdminUserEventsListener } from './listeners/admin-user-events.listener';
import { OrderEventsListener } from './listeners/order-events.listener';
import { UserEventsListener } from './listeners/user-events.listener';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyAccount, LoyaltyAccountSchema } from './schemas/loyalty-account.schema';
import { PrizeClaim, PrizeClaimSchema } from './schemas/prize-claim.schema';
import { ReferredIdentity, ReferredIdentitySchema } from './schemas/referred-identity.schema';
import { GamificationService } from './services/gamification.service';
import { LeaderboardNotificationService } from './services/leaderboard-notification.service';
import { PrizeClaimService } from './services/prize-claim.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: ReferredIdentity.name, schema: ReferredIdentitySchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: PrizeClaim.name, schema: PrizeClaimSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: MonthlyBagGoal.name, schema: MonthlyBagGoalSchema },
      // The season, for prize claiming. Registered as a model rather than
      // importing VotingModule, which would be circular — VotingModule already
      // imports LoyaltyModule.
      { name: VotingCycle.name, schema: VotingCycleSchema },
    ]),
    forwardRef(() => DonationsModule),
    forwardRef(() => VotingModule),
    MonthlyBagGoalModule,
    LeaderboardModule,
    NotificationsModule,
    ConfigModule,
  ],
  controllers: [LoyaltyController],
  providers: [
    LoyaltyService,
    GamificationService,
    PrizeClaimService,
    LeaderboardNotificationService,
    UserEventsListener,
    OrderEventsListener,
    AdminUserEventsListener,
  ],
  exports: [LoyaltyService, GamificationService, PrizeClaimService, MongooseModule],
})
export class LoyaltyModule {}
