import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EmailModule } from '../email/email.module';

import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseInquiry, EnterpriseInquirySchema } from './schemas/enterprise-inquiry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: EnterpriseInquiry.name, schema: EnterpriseInquirySchema }]),
    EmailModule,
  ],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
})
export class EnterpriseModule {}
