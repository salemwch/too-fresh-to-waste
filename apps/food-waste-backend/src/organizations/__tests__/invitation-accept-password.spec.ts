/**
 * Accepting a location-manager invitation sets the account's password.
 *
 * It ran only the DTO's length and character rules and hashed with argon2's
 * defaults, so a common or repetitive password that register and reset reject
 * was accepted, and the stored hash cost differed from every other account's
 * (a login timing tell for exactly these users). This pins both, real argon2.
 */

import { InvitationStatus } from '@foodwaste/shared';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { OrganizationsInvitationService } from '../organizations-invitation.service';

import type { PasswordPolicyService } from '../../auth/services/password-policy.service';
import type { EmailService } from '../../email/email.service';
import type { UsersService } from '../../users/user.service';
import type { OrganizationsService } from '../organizations.service';

const PASSWORD = 'Correct@Horse9Battery';

function setup(policy: Pick<PasswordPolicyService, 'validatePasswordStrength'>) {
  const invitation = {
    _id: new Types.ObjectId(),
    email: 'manager@example.test',
    status: InvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 60_000),
    assignedEstablishmentId: new Types.ObjectId(),
    organizationId: new Types.ObjectId(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const invitationModel = {
    findOne: () => ({ exec: jest.fn().mockResolvedValue(invitation) }),
  };
  const usersService = { createLocationManager: jest.fn().mockResolvedValue(undefined) };
  const service = new OrganizationsInvitationService(
    invitationModel as never,
    {} as OrganizationsService,
    usersService as unknown as UsersService,
    {} as EmailService,
    policy as PasswordPolicyService,
  );
  return { service, usersService };
}

const accept = async (service: OrganizationsInvitationService, password: string) => {
  const result = await service.accept({
    token: 't',
    password,
    firstName: 'Lina',
    lastName: 'Ben Ali',
  } as never);
  return result;
};

describe('OrganizationsInvitationService.accept', () => {
  it('runs the strength policy and creates nothing when it rejects', async () => {
    const validatePasswordStrength = jest.fn(() => {
      throw new BadRequestException({ code: 'PASSWORD_TOO_WEAK' });
    });
    const { service, usersService } = setup({ validatePasswordStrength });

    await expect(accept(service, 'Abcdef11111!')).rejects.toThrow(BadRequestException);

    expect(validatePasswordStrength).toHaveBeenCalledWith('Abcdef11111!', {
      email: 'manager@example.test',
      firstName: 'Lina',
      lastName: 'Ben Ali',
    });
    expect(usersService.createLocationManager).not.toHaveBeenCalled();
  });

  it('stores a hash with the same cost as every other user password', async () => {
    const { service, usersService } = setup({ validatePasswordStrength: jest.fn() });

    await accept(service, PASSWORD);

    const stored = (usersService.createLocationManager.mock.calls[0]?.[0] as { password: string })
      .password;
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
  });
});
