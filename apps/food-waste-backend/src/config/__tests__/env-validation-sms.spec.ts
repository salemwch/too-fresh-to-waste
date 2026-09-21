/**
 * SMS_ENABLED decides whether the three TWILIO_* values are mandatory in
 * production, and a conditional Joi schema fails quietly in both directions.
 *
 * Too strict and the API exits on config validation, PM2 restarts it, nothing
 * binds a port and Render reports only "no open ports detected" - the exact
 * failure already recorded for the Firebase rule next door.
 *
 * Too loose and SMS_ENABLED=true boots happily with no credentials, Twilio
 * never initialises, and every send fails at runtime instead of at startup.
 * That is the state this flag was introduced to end: TWILIO_PHONE_NUMBER named
 * a number the account did not own, the connectivity probe failed after ~8.3s
 * on every worker boot, and nothing ever refused to start.
 *
 * Both directions are asserted.
 */

import { envValidationSchema } from '../env.validation';

/**
 * Every non-Twilio key the schema requires in production, so each case below
 * turns on the SMS rule alone - a missing DATABASE_URL would otherwise mask it.
 */
const PRODUCTION_BASE = {
  NODE_ENV: 'production',
  DATABASE_URL: 'mongodb://user:pass@localhost:27017/foodwaste',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  CORS_ORIGINS: 'https://toofreshtowaste.com',
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM_ADDRESS: 'noreply@toofreshtowaste.com',
  BACKEND_URL: 'https://api.toofreshtowaste.com',
  FRONTEND_URL: 'https://toofreshtowaste.com',
  COOKIE_SECRET: 'c'.repeat(32),
  KONNECT_ORDER_WEBHOOK_URL: 'https://api.toofreshtowaste.com/webhooks/konnect',
  PRIVACY_ENCRYPTION_KEY: 'd'.repeat(32),
  FIREBASE_PROJECT_ID: 'foodwaste-prod',
  FIREBASE_SERVICE_ACCOUNT_PATH: '/etc/secrets/firebase.json',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const TWILIO_CREDENTIALS = {
  TWILIO_ACCOUNT_SID: `AC${'e'.repeat(32)}`,
  TWILIO_AUTH_TOKEN: 'f'.repeat(32),
  TWILIO_PHONE_NUMBER: '+21612345678',
};

/** Twilio-specific errors only - other keys are satisfied by PRODUCTION_BASE. */
function twilioErrors(env: Record<string, unknown>): string[] {
  const { error } = envValidationSchema.validate(env, { abortEarly: false });
  return (error?.details ?? [])
    .filter(d => String(d.path[0]).startsWith('TWILIO'))
    .map(d => String(d.path[0]));
}

function validatedValue(env: Record<string, unknown>, key: string): unknown {
  const { value } = envValidationSchema.validate(env, { abortEarly: false });
  return (value as Record<string, unknown>)[key];
}

describe('env validation - SMS master switch', () => {
  describe('SMS_ENABLED default', () => {
    it('is false when the variable is absent', () => {
      // The deploy depends on this: the fix reaches production on the next
      // release with no dashboard change. If the default flips to true, a
      // Render instance with no TWILIO_* values stops booting.
      expect(validatedValue(PRODUCTION_BASE, 'SMS_ENABLED')).toBe(false);
    });

    it.each([
      ['the string "true"', 'true', true],
      ['the string "false"', 'false', false],
      ['the boolean true', true, true],
      ['the boolean false', false, false],
    ])('coerces %s', (_label, raw, expected) => {
      // Env vars arrive as strings. A schema that only understood booleans
      // would read "false" as truthy and quietly re-enable SMS.
      expect(validatedValue({ ...PRODUCTION_BASE, SMS_ENABLED: raw }, 'SMS_ENABLED')).toBe(
        expected,
      );
    });
  });

  describe('production with SMS disabled', () => {
    it('boots with no Twilio credentials at all', () => {
      expect(twilioErrors(PRODUCTION_BASE)).toEqual([]);
    });

    it('boots when SMS_ENABLED is the string "false"', () => {
      expect(twilioErrors({ ...PRODUCTION_BASE, SMS_ENABLED: 'false' })).toEqual([]);
    });

    it('tolerates empty-string credentials left behind in the env group', () => {
      // Render keeps a key with a blank value rather than deleting it. A plain
      // Joi.string() rejects '', which would block the boot for a credential
      // nothing is going to read.
      expect(
        twilioErrors({
          ...PRODUCTION_BASE,
          SMS_ENABLED: 'false',
          TWILIO_ACCOUNT_SID: '',
          TWILIO_AUTH_TOKEN: '',
          TWILIO_PHONE_NUMBER: '',
        }),
      ).toEqual([]);
    });

    it('still accepts credentials that are present but unused', () => {
      // Turning SMS off should not force anyone to delete their keys first.
      expect(twilioErrors({ ...PRODUCTION_BASE, ...TWILIO_CREDENTIALS })).toEqual([]);
    });
  });

  describe('production with SMS enabled', () => {
    it('accepts a complete Twilio configuration', () => {
      expect(
        twilioErrors({ ...PRODUCTION_BASE, SMS_ENABLED: 'true', ...TWILIO_CREDENTIALS }),
      ).toEqual([]);
    });

    it('refuses to boot with no credentials', () => {
      expect(twilioErrors({ ...PRODUCTION_BASE, SMS_ENABLED: 'true' }).sort()).toEqual([
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_PHONE_NUMBER',
      ]);
    });

    it.each(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'])(
      'refuses to boot when %s alone is missing',
      missing => {
        const env: Record<string, unknown> = {
          ...PRODUCTION_BASE,
          SMS_ENABLED: 'true',
          ...TWILIO_CREDENTIALS,
        };
        delete env[missing];

        expect(twilioErrors(env)).toEqual([missing]);
      },
    );
  });

  describe('non-production', () => {
    it('never requires credentials, even with SMS enabled', () => {
      // Local development runs against the mock branch in sendSms.
      expect(
        twilioErrors({ ...PRODUCTION_BASE, NODE_ENV: 'development', SMS_ENABLED: 'true' }),
      ).toEqual([]);
    });
  });
});
