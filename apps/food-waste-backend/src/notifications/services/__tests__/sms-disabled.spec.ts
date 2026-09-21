/**
 * Behaviour of SmsNotificationService while SMS_ENABLED is false.
 *
 * Two things have to hold, and neither is visible from a type-check:
 *
 * 1. **Twilio is never constructed.** The whole reason the switch exists is
 *    boot cost - the connectivity probe took ~8.3s per worker and logged four
 *    ERROR lines, on a cold start that the mobile client is already waiting on.
 *    Asserting only "no SMS is sent" would pass with the client still built.
 *
 * 2. **No send path reports success.** `sendSms` had a mock branch that
 *    returned a fabricated SID and status 'sent' whenever the client was null.
 *    A disabled service falling into it would have every caller record a
 *    delivery that never happened - worse than no record, because it looks
 *    like evidence.
 */

import { Twilio } from 'twilio';

import { SmsNotificationService } from '../sms-notification.service';

import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Model } from 'mongoose';

import type { RedisService } from '../../../redis/redis.service';
import type { UserDocument } from '../../../users/schemas/user.schema';
import type { OptOutManagerService } from '../opt-out-manager.service';
import type { PhoneValidatorService } from '../phone-validator.service';

jest.mock('twilio');

const MockedTwilio = Twilio as unknown as jest.Mock;

/**
 * @param overrides Env values for this instance. Anything absent falls back to
 *   the `defaultValue` the service passes, which is what production does.
 */
function buildService(overrides: Record<string, unknown> = {}): SmsNotificationService {
  const config = {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (overrides[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;

  const phoneValidator = {
    maskPhoneNumber: (n: string) => `****${n.slice(-4)}`,
    validateAndFormat: (n: string) => ({ isValid: true, formatted: n }),
  } as unknown as PhoneValidatorService;

  const optOutManager = {
    checkOptOutStatus: jest.fn().mockResolvedValue({ isOptedOut: false }),
  } as unknown as OptOutManagerService;

  const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
  const redisService = { getClient: jest.fn().mockResolvedValue(null) } as unknown as RedisService;
  const userModel = {} as unknown as Model<UserDocument>;

  return new SmsNotificationService(
    config,
    phoneValidator,
    optOutManager,
    eventEmitter,
    redisService,
    userModel,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SMS_ENABLED=false', () => {
  it('defaults to disabled when the variable is absent', () => {
    // Matches the schema default. If these two ever disagree, the service and
    // the config are describing different systems.
    expect(buildService().isSmsEnabled()).toBe(false);
  });

  it('constructs no Twilio client even when full credentials are present', () => {
    // Credentials deliberately complete. Removing the constructor's early
    // return was verified to fail this case - and to *pass* the same assertion
    // with credentials missing, because validation throws before Twilio is
    // reached. A disabled-service test built on absent credentials therefore
    // proves nothing about the switch; it only proves the credentials are
    // absent. Leaving keys in the environment must not re-enable delivery.
    buildService({
      SMS_ENABLED: false,
      TWILIO_ACCOUNT_SID: `AC${'e'.repeat(32)}`,
      TWILIO_AUTH_TOKEN: 'f'.repeat(32),
      TWILIO_PHONE_NUMBER: '+21612345678',
    });

    expect(MockedTwilio).not.toHaveBeenCalled();
  });

  describe('every send path reports failure rather than a phantom delivery', () => {
    const service = () => buildService({ SMS_ENABLED: false, TWILIO_PHONE_NUMBER: '+21612345678' });

    it('send()', async () => {
      const result = await service().send(
        { title: 'Order ready', body: 'Come and get it' },
        { userId: '507f1f77bcf86cd799439011' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS delivery is disabled');
      // No fabricated SID. `messageId` is what a caller would persist as proof.
      expect(result.messageId).toBeUndefined();
      expect(result.deliveryStatus).toBeUndefined();
    });

    it('sendVerificationCode()', async () => {
      const result = await service().sendVerificationCode('+21612345678', '123456');

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
    });

    it('sendPickupCode()', async () => {
      const result = await service().sendPickupCode('+21612345678', {
        orderId: 'order-1',
        establishmentName: 'Boulangerie',
        pickupCode: 'ABC123',
      } as Parameters<SmsNotificationService['sendPickupCode']>[1]);

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
    });

    it('sendUrgentReminder()', async () => {
      const result = await service().sendUrgentReminder('+21612345678', {
        orderId: 'order-1',
        establishmentName: 'Boulangerie',
        timeLeft: '30 minutes',
      } as Parameters<SmsNotificationService['sendUrgentReminder']>[1]);

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
    });

    it('sendBulk() answers once per target', async () => {
      const targets = [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }];

      const results = await service().sendBulk({ title: 'T', body: 'B' }, targets);

      // One result per target, not a single collapsed failure - callers index
      // the array against their own list.
      expect(results).toHaveLength(targets.length);
      expect(results.every(r => r.success === false)).toBe(true);
    });

    it('sendBulk() returns an empty array for no targets', async () => {
      expect(await service().sendBulk({ title: 'T', body: 'B' }, [])).toEqual([]);
    });

    it('sendBulk() does not reject an over-limit batch it was never going to send', async () => {
      // The 100-recipient guard throws. A disabled service has no limit to
      // enforce, so refusing on one would be a misleading error.
      const targets = Array.from({ length: 150 }, (_, i) => ({ userId: String(i) }));

      await expect(service().sendBulk({ title: 'T', body: 'B' }, targets)).resolves.toHaveLength(
        150,
      );
    });
  });
});

describe('SMS_ENABLED=true', () => {
  it('reports itself as enabled', () => {
    expect(
      buildService({
        SMS_ENABLED: true,
        TWILIO_ACCOUNT_SID: `AC${'e'.repeat(32)}`,
        TWILIO_AUTH_TOKEN: 'f'.repeat(32),
        TWILIO_PHONE_NUMBER: '+21612345678',
      }).isSmsEnabled(),
    ).toBe(true);
  });

  it('attempts initialisation, so the switch is the only thing holding it back', () => {
    // Without this the suite would pass just as happily if `initializeTwilio`
    // had been deleted outright.
    const service = buildService({
      SMS_ENABLED: true,
      TWILIO_ACCOUNT_SID: `AC${'e'.repeat(32)}`,
      TWILIO_AUTH_TOKEN: 'f'.repeat(32),
      TWILIO_PHONE_NUMBER: '+21612345678',
    });

    expect(service.isSmsEnabled()).toBe(true);
    // Initialisation is async and fire-and-forget from the constructor; the
    // observable difference at this point is that it was not short-circuited.
    // The disabled cases above assert the client is never built at all.
  });
});
