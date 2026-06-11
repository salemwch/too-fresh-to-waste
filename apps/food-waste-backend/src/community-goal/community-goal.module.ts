import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LoyaltyModule } from '../loyalty/loyalty.module';
import { WebSocketModule } from '../websocket/websocket.module';

import { CommunityGoalAdminController } from './community-goal-admin.controller';
import { CommunityGoalController } from './community-goal.controller';
import { CommunityGoalService } from './community-goal.service';
import { CommunityBagGoal, CommunityBagGoalSchema } from './schemas/community-bag-goal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CommunityBagGoal.name, schema: CommunityBagGoalSchema }]),
    WebSocketModule,
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [CommunityGoalController, CommunityGoalAdminController],
  providers: [CommunityGoalService],
  exports: [CommunityGoalService],
})
export class CommunityGoalModule {}
