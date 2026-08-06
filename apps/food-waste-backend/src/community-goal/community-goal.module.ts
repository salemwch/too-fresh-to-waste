import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WebSocketModule } from '../websocket/websocket.module';

import { MonthlyBagGoalAdminController } from './community-goal-admin.controller';
import { MonthlyBagGoalController } from './community-goal.controller';
import { MonthlyBagGoalService } from './community-goal.service';
import { MonthlyBagGoal, MonthlyBagGoalSchema } from './schemas/community-bag-goal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MonthlyBagGoal.name, schema: MonthlyBagGoalSchema }]),
    WebSocketModule,
  ],
  controllers: [MonthlyBagGoalController, MonthlyBagGoalAdminController],
  providers: [MonthlyBagGoalService],
  exports: [MonthlyBagGoalService],
})
export class MonthlyBagGoalModule {}
