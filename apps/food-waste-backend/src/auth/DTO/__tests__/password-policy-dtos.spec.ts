/**
 * Every DTO that sets a password enforces the same shared policy.
 *
 * Change-password and the forced first change used to accept 8 characters
 * (the forced one with no complexity rule at all) while register and reset
 * demanded 12, and `POST /users` accepted 8 until 2026-09-25. Driving every
 * password DTO from one table keeps them from drifting apart again: a DTO that
 * weakens its rule fails here, not in a security review.
 *
 * Only the password field's errors count, so DTOs with other required fields
 * (register, invitation) can be driven with the password alone.
 */

import { PASSWORD_MIN_LENGTH } from '@foodwaste/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { toFieldErrors } from '../../../common/errors/validation-errors';
import { AcceptInvitationDto } from '../../../organizations/dto/accept-invitation.dto';
import { CreateUserDto } from '../../../users/DTO/create-user.dto';
import { UpdatePasswordDto } from '../../../users/DTO/update-password.dto';
import { ForcePasswordChangeDto } from '../force-password-change.dto';
import { RegisterDto } from '../register.dto';
import { ResetPasswordDto } from '../reset-password.dto';

type Case = [name: string, field: string, build: (password: string) => object];

const DTOS: Case[] = [
  [
    'UpdatePasswordDto',
    'newPassword',
    p => plainToInstance(UpdatePasswordDto, { currentPassword: 'Old@Password1', newPassword: p }),
  ],
  [
    'ForcePasswordChangeDto',
    'newPassword',
    p => plainToInstance(ForcePasswordChangeDto, { newPassword: p }),
  ],
  [
    'ResetPasswordDto',
    'newPassword',
    p => plainToInstance(ResetPasswordDto, { token: 'tok', newPassword: p }),
  ],
  ['RegisterDto', 'password', p => plainToInstance(RegisterDto, { password: p })],
  ['AcceptInvitationDto', 'password', p => plainToInstance(AcceptInvitationDto, { password: p })],
  ['CreateUserDto (POST /users)', 'password', p => plainToInstance(CreateUserDto, { password: p })],
];

const passwordErrors = async (dto: object, field: string) =>
  (await validate(dto)).filter(error => error.property === field);

const VALID = 'Abcdefghij1!'; // exactly PASSWORD_MIN_LENGTH

describe.each(DTOS)('%s', (_name, field, build) => {
  it('accepts a password at exactly the policy minimum', async () => {
    expect(VALID).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(await passwordErrors(build(VALID), field)).toEqual([]);
  });

  // The client gets PASSWORD_POLICY - which states the rule, in its language -
  // not VALIDATION_FORMAT's "not in the expected format".
  it('reports a missing character class as PASSWORD_POLICY', async () => {
    const codes = toFieldErrors(await passwordErrors(build('abcdefghij1!'), field)).map(
      e => e.code,
    );
    expect(codes).toEqual(['PASSWORD_POLICY']);
  });

  it.each([
    ['one character short', 'Abcdefghi1!'],
    ['the old 8-character minimum', 'Abcdef1!'],
    ['no uppercase', 'abcdefghij1!'],
    ['no lowercase', 'ABCDEFGHIJ1!'],
    ['no digit', 'Abcdefghijk!'],
    ['no special character', 'Abcdefghij12'],
    ['a special character outside the policy set', 'Abcdefghij1#'],
    ['a space', 'Abcdefghij 1!'],
    ['longer than the maximum', `Aa1!${'x'.repeat(200)}`],
  ])('rejects %s', async (_case, password) => {
    expect(await passwordErrors(build(password), field)).not.toEqual([]);
  });
});
