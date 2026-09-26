/**
 * UsersService.updatePassword — the update actually sent to MongoDB
 *
 * These tests exist because of a silent failure that unit tests asserting
 * "updatePassword was called" could never have caught.
 *
 * The update object used to clear fields by assigning `undefined`:
 *
 *   { password, passwordResetToken: undefined, accountLockedUntil: undefined }
 *
 * Mongoose deletes any key whose value is `undefined` before the update leaves
 * the process (lib/helpers/query/castUpdate.js: `if (obj[key] === void 0)
 * delete obj[key]`). So those two lines did nothing:
 *
 *   - the password reset token survived its own use and stayed valid for the
 *     rest of its one-hour window, making reset links replayable;
 *   - a locked account stayed locked after resetting its password, even though
 *     `failedLoginAttempts: 0` (a real value, so it did apply) was cleared
 *     right beside it.
 *
 * The fix is $unset. These tests assert the shape of the update rather than the
 * fact of the call, because the shape is where the bug was.
 */

import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import { PhoneNumberService } from '../../common/services/phone-number.service';
import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import { SmsNotificationService } from '../../notifications/services/sms-notification.service';
import { User } from '../schemas/user.schema';
import { PasswordHistoryService } from '../../auth/services/password-history.service';
import { PasswordPolicyService } from '../../auth/services/password-policy.service';
import { UsersService } from '../user.service';

import type { UserDocument } from '../schemas/user.schema';
import type { TestingModule } from '@nestjs/testing';

import { EN } from '../../common/errors/catalog/en';
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2,
}));

const USER_ID = '507f1f77bcf86c0012345678';

describe('UsersService.updatePassword', () => {
  let service: UsersService;
  let findByIdAndUpdate: jest.Mock;

  /** The update document handed to Mongoose on the last call. */
  const lastUpdate = () =>
    findByIdAndUpdate.mock.calls[findByIdAndUpdate.mock.calls.length - 1]?.[1] as Record<
      string,
      unknown
    >;

  beforeEach(async () => {
    findByIdAndUpdate = jest.fn().mockResolvedValue({});

    const userModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: USER_ID,
          password: '$argon2id$existing',
          securitySettings: { passwordHistory: [] },
        } as unknown as UserDocument),
      }),
      findByIdAndUpdate,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: PasswordPolicyService, useValue: { validatePasswordStrength: jest.fn() } },
        { provide: PhoneNumberService, useValue: { validatePhoneNumber: jest.fn() } },
        { provide: SmsNotificationService, useValue: { sendSms: jest.fn() } },
        {
          provide: PasswordHistoryService,
          useValue: {
            validatePasswordHistory: jest.fn().mockResolvedValue(undefined),
            addToHistory: jest.fn().mockReturnValue(['$argon2id$existing']),
            isHistoryEnforced: jest.fn().mockReturnValue(true),
            getPasswordHistoryCount: jest.fn().mockReturnValue(5),
          },
        },
        { provide: EventBusService, useValue: { emit: jest.fn() } },
        { provide: RegexSecurityUtil, useValue: {} },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // The regression. `passwordResetToken: undefined` is silently dropped by
  // Mongoose; only $unset actually removes the field.
  it('clears the reset token with $unset so the link cannot be replayed', async () => {
    await service.updatePassword(USER_ID, 'NewPass123!@#');

    const update = lastUpdate();

    expect(update['$unset']).toMatchObject({
      passwordResetToken: expect.anything(),
      passwordResetExpires: expect.anything(),
    });
  });

  it('unlocks the account, so a reset is a way out of a lockout', async () => {
    await service.updatePassword(USER_ID, 'NewPass123!@#');

    expect(lastUpdate()['$unset']).toMatchObject({ accountLockedUntil: expect.anything() });
    expect(lastUpdate()['$set']).toMatchObject({ failedLoginAttempts: 0 });
  });

  // Guards the exact failure mode: an `undefined` anywhere in the update is a
  // field the author believed they were clearing and silently were not.
  it('never tries to clear a field by assigning undefined', async () => {
    const hasUndefinedLeaf = (value: unknown): boolean => {
      if (value === undefined) {
        return true;
      }
      if (value === null || typeof value !== 'object') {
        return false;
      }
      return Object.values(value as Record<string, unknown>).some(hasUndefinedLeaf);
    };

    await service.updatePassword(USER_ID, 'NewPass123!@#');

    expect(hasUndefinedLeaf(lastUpdate())).toBe(false);
  });

  it('writes the new hash and records the change', async () => {
    await service.updatePassword(USER_ID, 'NewPass123!@#');

    expect(argon2.hash).toHaveBeenCalledWith('NewPass123!@#', expect.objectContaining({ type: 2 }));
    expect(lastUpdate()['$set']).toMatchObject({
      password: '$argon2id$hashed',
      'securitySettings.lastPasswordChange': expect.any(Date),
    });
  });

  it('keeps the audit entry alongside $set/$unset when audit data is given', async () => {
    await service.updatePassword(USER_ID, 'NewPass123!@#', undefined, {
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });

    const update = lastUpdate();

    expect(update['$push']).toBeDefined();
    expect(update['$set']).toBeDefined();
    expect(update['$unset']).toBeDefined();
  });

  it('rejects a wrong current password before touching the document', async () => {
    (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

    await expect(service.updatePassword(USER_ID, 'NewPass123!@#', 'wrong-current')).rejects.toThrow(
      EN.CURRENT_PASSWORD_INCORRECT,
    );
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
