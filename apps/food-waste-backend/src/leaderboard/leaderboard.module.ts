import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LoyaltyAccount, LoyaltyAccountSchema } from '../loyalty/schemas/loyalty-account.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LeaderboardCacheService } from './leaderboard-cache.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardCacheService],
  exports: [LeaderboardService, LeaderboardCacheService],
})
export class LeaderboardModule {}
