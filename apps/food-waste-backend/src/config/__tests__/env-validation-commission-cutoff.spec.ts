/**
 * COMMISSION_MODEL_EFFECTIVE_AT - the instant the commission-settlement model
 * starts applying. See `.claude/work/commission-settlement-model.md`.
 *
 * Sales completed before it are never re-accrued. That makes the value money:
 * a wrong or silently-defaulted instant either charges merchants 19% on sales
 * made under the old rules, or skips commission on sales made under the new
 * ones. So the schema must refuse to boot production without it, and must
 * refuse any value whose instant is ambiguous.
 *
 * There is deliberately no default. The date is chosen by the product owner at
 * release; the sample values below exist only in this test.
 *
 * RED until implementation step 2 declares the key in env.validation.ts.
 */

import { envValidationSchema } from '../env.validation';

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

const KEY = 'COMMISSION_MODEL_EFFECTIVE_AT';

/** Errors on this key only - every other key is satisfied by PRODUCTION_BASE. */
function cutoffErrors(env: Record<string, unknown>): string[] {
  const { error } = envValidationSchema.validate(env, { abortEarly: false });
  return (error?.details ?? []).filter(d => d.path[0] === KEY).map(d => d.type);
}

describe('env validation - COMMISSION_MODEL_EFFECTIVE_AT', () => {
  describe('in production', () => {
    it('is required: a missing cutoff must stop the boot, not mean "now" or "never"', () => {
      expect(cutoffErrors(PRODUCTION_BASE)).not.toEqual([]);
    });

    it.each([
      ['a positive offset', '2026-10-01T00:00:00+01:00'],
      ['UTC written as Z', '2026-09-30T23:00:00Z'],
      ['UTC written as +00:00', '2026-09-30T23:00:00+00:00'],
      ['milliseconds and an offset', '2026-10-01T00:00:00.000+01:00'],
    ])('accepts an instant with %s', (_label, value) => {
      expect(cutoffErrors({ ...PRODUCTION_BASE, [KEY]: value })).toEqual([]);
    });

    it.each([
      ['no offset - server-local time, a different instant per host', '2026-10-01T00:00:00'],
      ['a date only - which midnight?', '2026-10-01'],
      ['free text', 'next monday'],
      ['an empty string', ''],
      ['an impossible date', '2026-02-30T00:00:00+01:00'],
      ['a unix timestamp - no visible offset', '1790809200'],
    ])('rejects %s', (_label, value) => {
      expect(cutoffErrors({ ...PRODUCTION_BASE, [KEY]: value })).not.toEqual([]);
    });

    it('keeps the configured instant exactly, rather than rewriting it', () => {
      const value = '2026-10-01T00:00:00+01:00';
      const { value: validated } = envValidationSchema.validate(
        { ...PRODUCTION_BASE, [KEY]: value },
        { abortEarly: false },
      );
      const parsed = new Date(String((validated as Record<string, unknown>)[KEY]));
      expect(parsed.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    });
  });

  describe('outside production', () => {
    it('may be absent, which leaves the new model inactive', () => {
      const { NODE_ENV: _drop, ...rest } = PRODUCTION_BASE;
      expect(cutoffErrors({ ...rest, NODE_ENV: 'development' })).toEqual([]);
    });

    it('accepts the empty value .env.example ships with, as inactive', () => {
      // A developer copying .env.example gets `COMMISSION_MODEL_EFFECTIVE_AT=`.
      // That must boot locally, not fail on "string.empty".
      const { NODE_ENV: _drop, ...rest } = PRODUCTION_BASE;
      expect(cutoffErrors({ ...rest, NODE_ENV: 'development', [KEY]: '' })).toEqual([]);
    });

    it('still rejects an offset-less value when one is given', () => {
      const { NODE_ENV: _drop, ...rest } = PRODUCTION_BASE;
      expect(
        cutoffErrors({ ...rest, NODE_ENV: 'development', [KEY]: '2026-10-01T00:00:00' }),
      ).not.toEqual([]);
    });
  });
});
