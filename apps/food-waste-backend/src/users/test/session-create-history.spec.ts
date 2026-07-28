/**
 * SessionManagementService.createSession — the update actually sent to MongoDB
 *
 * `loginHistory` and `auditLog` are security audit trails, and this service used
 * to maintain them in application memory:
 *
 *   user.loginHistory.unshift(entry);
 *   if (user.loginHistory.length > MAX) user.loginHistory = slice(0, MAX);
 *   await user.save();
 *
 * That is a read-modify-write. Two logins that overlap — the same person signing
 * in on a phone and a laptop, or a retried request — each read the same array,
 * each appended their own entry, and the second `save()` overwrote the first. One
 * login silently disappeared from the record of who accessed the account. There
 * is no error and nothing in the logs; the trail is simply short.
 *
 * The sibling `auth/services/session-management.service.ts` writes the same two
 * fields and already did this atomically. The two must not diverge, so these
 * tests assert the *shape* of the update — a single `$push` with `$slice`, no
 * `save()` — because the shape is where the bug was. Asserting "updateOne was
 * called" would pass against the broken version too.
 */

import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import {
  USER_AUDIT_LOG_MAX,
  USER_LOGIN_HISTORY_MAX,
} from '../../common/constants/document-limits.constant';
import { User } from '../schemas/user.schema';
import { SessionManagementService, type DeviceInfo } from '../services/session-management.service';

import type { TestingModule } from '@nestjs/testing';

const DEVICE: DeviceInfo = {
  deviceId: 'device-1',
  deviceFingerprint: 'fp-1',
  deviceName: 'Pixel 8',
  platform: 'android',
  browser: 'chrome',
  userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  // Documentation range (RFC 5737) — geoip resolves nothing, so `location` is
  // undefined and the test does not depend on a bundled geo database.
  ipAddress: '203.0.113.7',
};

describe('SessionManagementService.createSession — login history update', () => {
  let service: SessionManagementService;
  let updateOne: jest.Mock;
  let findById: jest.Mock;
  let save: jest.Mock;

  beforeEach(async () => {
    save = jest.fn();
    updateOne = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'user-1', email: 'saver@example.com', save }),
      }),
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagementService,
        { provide: getModelToken(User.name), useValue: { findById, updateOne } },
      ],
    }).compile();

    service = moduleRef.get(SessionManagementService);
  });

  /** Reach into the single update the service issued. */
  function capturedUpdate(): Record<string, any> {
    expect(updateOne).toHaveBeenCalledTimes(1);
    return updateOne.mock.calls[0]![1] as Record<string, any>;
  }

  it('appends to loginHistory server-side rather than rewriting the array', async () => {
    await service.createSession('user-1', DEVICE);

    const push = capturedUpdate()['$push']['loginHistory'];

    // $each + $position, not a whole replacement array. A plain
    // `{ loginHistory: [...] }` under $set would reintroduce the lost update.
    expect(push['$each']).toHaveLength(1);
    expect(push['$position']).toBe(0);
    expect(push['$each'][0]).toMatchObject({
      ipAddress: DEVICE.ipAddress,
      userAgent: DEVICE.userAgent,
    });
  });

  it('caps loginHistory at USER_LOGIN_HISTORY_MAX in the update itself', async () => {
    await service.createSession('user-1', DEVICE);

    // Positive $slice keeps the FIRST n. Combined with $position: 0 that is the
    // newest n. A negative value here would silently retain the oldest instead.
    expect(capturedUpdate()['$push']['loginHistory']['$slice']).toBe(USER_LOGIN_HISTORY_MAX);
    expect(USER_LOGIN_HISTORY_MAX).toBeGreaterThan(0);
  });

  it('caps auditLog at USER_AUDIT_LOG_MAX and records the LOGIN action', async () => {
    await service.createSession('user-1', DEVICE);

    const push = capturedUpdate()['$push']['auditLog'];

    expect(push['$slice']).toBe(USER_AUDIT_LOG_MAX);
    expect(push['$position']).toBe(0);
    expect(push['$each'][0]).toMatchObject({ action: 'LOGIN' });
  });

  it('writes both arrays and lastLoginAt in one round trip', async () => {
    await service.createSession('user-1', DEVICE);

    const update = capturedUpdate();

    // One update, both arrays. Two separate updateOne calls would let a crash
    // between them leave the login recorded in one trail but not the other.
    expect(Object.keys(update['$push'])).toEqual(
      expect.arrayContaining(['loginHistory', 'auditLog']),
    );
    expect(update['$set']['lastLoginAt']).toBeInstanceOf(Date);
  });

  it('never calls save() — the document is not mutated in memory', async () => {
    await service.createSession('user-1', DEVICE);

    // This is the regression guard. The old implementation's only write was
    // `user.save()`; if it ever returns, concurrent logins start losing entries.
    expect(save).not.toHaveBeenCalled();
  });

  it('stamps loginHistory and auditLog with the same timestamp', async () => {
    await service.createSession('user-1', DEVICE);

    const update = capturedUpdate();
    const loginAt = update['$push']['loginHistory']['$each'][0]['timestamp'];
    const auditAt = update['$push']['auditLog']['$each'][0]['timestamp'];

    // Both entries describe one event, so they must not be a few milliseconds
    // apart — that would make the two trails impossible to correlate.
    expect(loginAt).toEqual(auditAt);
    expect(loginAt).toEqual(update['$set']['lastLoginAt']);
  });

  describe('when the user does not exist', () => {
    beforeEach(() => {
      findById.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });
    });

    it('rejects with a user-facing message', async () => {
      await expect(service.createSession('ghost', DEVICE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('writes nothing — a failed lookup leaves the document untouched', async () => {
      await expect(service.createSession('ghost', DEVICE)).rejects.toThrow();

      // Asserting the absence of the write, not merely that it threw: an
      // implementation that pushed history before validating would still throw.
      expect(updateOne).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });
  });
});
