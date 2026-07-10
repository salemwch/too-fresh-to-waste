import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PrizeClaim, PrizeClaimSchema } from '../loyalty/schemas/prize-claim.schema';
import { NotificationsModule } from '../notifications/notifications.module';

import { Counter, CounterSchema } from './schemas/counter.schema';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { VotingAuditLog, VotingAuditLogSchema } from './schemas/voting-audit-log.schema';
import { VotingCycle, VotingCycleSchema } from './schemas/voting-cycle.schema';
import { VotingEligibility, VotingEligibilitySchema } from './schemas/voting-eligibility.schema';
import { VotingAdminController } from './voting-admin.controller';
import { VotingController } from './voting.controller';
import { VotingCron } from './voting.cron';
import { VotingPrizeService } from './services/voting-prize.service';
import { VotingService } from './voting.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VotingCycle.name, schema: VotingCycleSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: VotingEligibility.name, schema: VotingEligibilitySchema },
      { name: VotingAuditLog.name, schema: VotingAuditLogSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: PrizeClaim.name, schema: PrizeClaimSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
    ]),
    forwardRef(() => LoyaltyModule),
    NotificationsModule,
  ],
  controllers: [VotingController, VotingAdminController],
  providers: [VotingService, VotingCron, VotingPrizeService],
  exports: [VotingService, VotingPrizeService],
})
export class VotingModule {}
