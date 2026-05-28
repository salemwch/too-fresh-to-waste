import { randomBytes } from 'crypto';

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model, Types } from 'mongoose';

import { InvitationStatus, OrganizationRole } from '@foodwaste/shared';

import { EmailService } from '../email/email.service';
import { UsersService } from '../users/user.service';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { OrganizationsService } from './organizations.service';
import {
  OrganizationInvitation,
  OrganizationInvitationDocument,
} from './schemas/organization-invitation.schema';

/** 7 days in milliseconds */
const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class OrganizationsInvitationService {
  private readonly logger = new Logger(OrganizationsInvitationService.name);

  constructor(
    @InjectModel(OrganizationInvitation.name)
    private readonly invitationModel: Model<OrganizationInvitationDocument>,
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Invite a new member (location manager) to the organization.
   * Owner only — the org lookup enforces this.
   */
  async invite(
    orgId: string,
    dto: InviteMemberDto,
    invitedByUserId: string,
  ): Promise<OrganizationInvitationDocument> {
    const org = await this.organizationsService.findById(orgId);

    if (org.ownerId.toString() !== invitedByUserId) {
      throw new ForbiddenException('Only the organization owner can send invitations');
    }

    // Check the assigned establishment belongs to this org
    const establishmentBelongs = org.establishmentIds.some(
      id => id.toString() === dto.assignedEstablishmentId,
    );
    if (!establishmentBelongs) {
      throw new BadRequestException(
        'The assigned establishment does not belong to this organization',
      );
    }

    // Prevent duplicate pending invitations for the same email + org
    const existingPending = await this.invitationModel
      .findOne({
        organizationId: new Types.ObjectId(orgId),
        email: dto.email.toLowerCase(),
        status: InvitationStatus.PENDING,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (existingPending) {
      throw new ConflictException(
        'A pending invitation for this email already exists in this organization',
      );
    }

    // Check if the user already exists and has an account
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists on the platform');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

    const invitation = new this.invitationModel({
      organizationId: new Types.ObjectId(orgId),
      email: dto.email.toLowerCase(),
      role: OrganizationRole.LOCATION_MANAGER,
      assignedEstablishmentId: new Types.ObjectId(dto.assignedEstablishmentId),
      status: InvitationStatus.PENDING,
      invitedBy: new Types.ObjectId(invitedByUserId),
      token,
      expiresAt,
    });

    const saved = await invitation.save();

    this.logger.log(
      `Invitation created for ${dto.email} to org ${orgId} by user ${invitedByUserId}`,
    );

    // Fire-and-forget: send invitation email
    this.sendInvitationEmail(dto.email, org.name, token).catch((error: unknown) => {
      this.logger.error(
        `Failed to send invitation email to ${dto.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });

    return saved;
  }

  /**
   * Accept an invitation: validate token, create the user account, mark accepted.
   */
  async accept(dto: AcceptInvitationDto): Promise<{ message: string }> {
    const invitation = await this.invitationModel.findOne({ token: dto.token }).exec();

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is no longer valid (status: ${invitation.status})`);
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      invitation.status = InvitationStatus.EXPIRED;
      await invitation.save();
      throw new BadRequestException('Invitation has expired');
    }

    // Hash the password the same way auth.service does
    const hashedPassword = await argon2.hash(dto.password);

    // Create the location manager user account
    // createLocationManager is added in Task 6; calling it here for future wiring
    await (
      this.usersService as unknown as {
        createLocationManager: (data: {
          email: string;
          password: string;
          firstName: string;
          lastName: string;
          phoneNumber?: string | undefined;
          assignedEstablishmentId: string;
          organizationId: string;
        }) => Promise<unknown>;
      }
    ).createLocationManager({
      email: invitation.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      ...(dto.phoneNumber ? { phoneNumber: dto.phoneNumber } : {}),
      assignedEstablishmentId: invitation.assignedEstablishmentId.toString(),
      organizationId: invitation.organizationId.toString(),
    });

    // Mark invitation as accepted
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    await invitation.save();

    this.logger.log(`Invitation accepted: ${invitation._id} for email ${invitation.email}`);

    return { message: 'Invitation accepted. Your account has been created.' };
  }

  /**
   * List all invitations for an organization (owner only).
   */
  async findByOrganization(
    orgId: string,
    userId: string,
  ): Promise<OrganizationInvitationDocument[]> {
    const org = await this.organizationsService.findById(orgId);

    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException('Only the organization owner can view invitations');
    }

    return this.invitationModel
      .find({ organizationId: new Types.ObjectId(orgId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Revoke a pending invitation (owner only).
   */
  async revoke(invitationId: string, userId: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(invitationId)) {
      throw new BadRequestException('Invalid invitation ID');
    }

    const invitation = await this.invitationModel.findById(invitationId).exec();

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    // Verify the caller owns the organization
    const org = await this.organizationsService.findById(invitation.organizationId.toString());

    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException('Only the organization owner can revoke invitations');
    }

    invitation.status = InvitationStatus.REVOKED;
    await invitation.save();

    this.logger.log(`Invitation ${invitationId} revoked by user ${userId}`);
    return { message: 'Invitation revoked successfully' };
  }

  /**
   * Public: verify an invitation token and return org/establishment context.
   */
  async getByToken(token: string): Promise<{
    email: string;
    organizationName: string;
    assignedEstablishmentId: string;
    expiresAt: Date;
    isValid: boolean;
  }> {
    const invitation = await this.invitationModel
      .findOne({ token })
      .populate<{ organizationId: { name: string } }>('organizationId', 'name')
      .exec();

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const isValid =
      invitation.status === InvitationStatus.PENDING && invitation.expiresAt > new Date();

    const orgName =
      typeof invitation.organizationId === 'object' &&
      invitation.organizationId !== null &&
      'name' in invitation.organizationId
        ? (invitation.organizationId as unknown as { name: string }).name
        : 'Unknown Organization';

    return {
      email: invitation.email,
      organizationName: orgName,
      assignedEstablishmentId: invitation.assignedEstablishmentId.toString(),
      expiresAt: invitation.expiresAt,
      isValid,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async sendInvitationEmail(
    recipientEmail: string,
    organizationName: string,
    token: string,
  ): Promise<void> {
    const frontendUrl =
      process.env['FRONTEND_URL'] ?? process.env['WEB_FRONTEND_URL'] ?? 'http://localhost:3001';

    const invitationUrl = `${frontendUrl}/invitations/accept?token=${encodeURIComponent(token)}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to join ${organizationName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1E4448;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;">Too Fresh To Waste</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1E4448;font-size:20px;margin:0 0 16px;">You've been invited!</h2>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
                You have been invited to join <strong>${organizationName}</strong> as a Location Manager
                on the Too Fresh To Waste platform.
              </p>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Click the button below to create your account and accept the invitation.
                This link expires in <strong>7 days</strong>.
              </p>
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background-color:#1E4448;border-radius:8px;padding:14px 32px;text-align:center;">
                    <a href="${invitationUrl}" style="color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#6b7280;font-size:13px;margin:0;">
                If the button doesn't work, copy and paste this URL into your browser:<br />
                <a href="${invitationUrl}" style="color:#1E4448;word-break:break-all;">${invitationUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = [
      `You've been invited to join ${organizationName} as a Location Manager on Too Fresh To Waste.`,
      '',
      'Accept your invitation by visiting:',
      invitationUrl,
      '',
      'This link expires in 7 days.',
      '',
      'If you did not expect this invitation, you can safely ignore this email.',
    ].join('\n');

    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: `You're invited to join ${organizationName} on Too Fresh To Waste`,
      html,
      text,
    });
  }
}
