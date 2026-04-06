import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WebSocketModule } from '../websocket/websocket.module';

import { CommunityGoalAdminController } from './community-goal-admin.controller';
import { CommunityGoalController } from './community-goal.controller';
import { CommunityGoalService } from './community-goal.service';
import { CommunityBagGoal, CommunityBagGoalSchema } from './schemas/community-bag-goal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CommunityBagGoal.name, schema: CommunityBagGoalSchema }]),
    WebSocketModule,
  ],
  controllers: [CommunityGoalController, CommunityGoalAdminController],
  providers: [CommunityGoalService],
  exports: [CommunityGoalService],
})
export class CommunityGoalModule {}
