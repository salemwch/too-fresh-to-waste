import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/user.module';

import { OrganizationsController } from './organizations.controller';
import { OrganizationsInvitationService } from './organizations-invitation.service';
import { OrganizationsService } from './organizations.service';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import {
  OrganizationInvitation,
  OrganizationInvitationSchema,
} from './schemas/organization-invitation.schema';

@Module({
  imports: [
    CommonModule,
    EmailModule,
    forwardRef(() => UsersModule),
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrganizationInvitation.name, schema: OrganizationInvitationSchema },
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsInvitationService],
  exports: [OrganizationsService, OrganizationsInvitationService, MongooseModule],
})
export class OrganizationsModule {}
