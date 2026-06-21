import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LoyaltyModule } from '../loyalty/loyalty.module';

import { Counter, CounterSchema } from './schemas/counter.schema';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { VotingAuditLog, VotingAuditLogSchema } from './schemas/voting-audit-log.schema';
import { VotingCycle, VotingCycleSchema } from './schemas/voting-cycle.schema';
import { VotingEligibility, VotingEligibilitySchema } from './schemas/voting-eligibility.schema';
import { VotingService } from './voting.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VotingCycle.name, schema: VotingCycleSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: VotingEligibility.name, schema: VotingEligibilitySchema },
      { name: VotingAuditLog.name, schema: VotingAuditLogSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    LoyaltyModule,
  ],
  providers: [VotingService],
  exports: [VotingService],
})
export class VotingModule {}
