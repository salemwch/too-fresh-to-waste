import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { GamificationService } from './services/gamification.service';
import { LoyaltyAccount, LoyaltyAccountSchema } from './schemas/loyalty-account.schema';
import { DonationsModule } from '../donations/donations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
    ]),
    forwardRef(() => DonationsModule),
  ],
  controllers: [LoyaltyController],
  providers: [LoyaltyService, GamificationService],
  exports: [LoyaltyService, GamificationService, MongooseModule],
})
export class LoyaltyModule {}
