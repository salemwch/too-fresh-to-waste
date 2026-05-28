import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Organization, OrganizationSchema } from './schemas/organization.schema';
import {
  OrganizationInvitation,
  OrganizationInvitationSchema,
} from './schemas/organization-invitation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrganizationInvitation.name, schema: OrganizationInvitationSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class OrganizationsModule {}
