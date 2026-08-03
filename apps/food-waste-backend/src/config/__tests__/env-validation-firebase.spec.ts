/**
 * Firebase credentials are accepted from two sources, and the schema has to
 * agree with the service about that.
 *
 * FirebaseAdminService.initializeFirebase reads FIREBASE_SERVICE_ACCOUNT_PATH
 * first and falls back to FIREBASE_SERVICE_ACCOUNT (the same JSON inline). The
 * schema used to require the path alone, which meant a container — where there
 * is no secrets file to point at and credentials arrive through the
 * environment — could not start in production at all. The API exited on config
 * validation, PM2 restarted it, nothing ever bound a port, and the platform
 * reported a port-scan timeout rather than the actual cause.
 *
 * A conditional Joi schema fails quietly in both directions: too strict and
 * production will not boot, too loose and push notifications ship
 * unconfigured. Both directions are asserted here.
 */

import { envValidationSchema } from '../env.validation';

/**
 * Every non-Firebase key the schema requires in production.
 *
 * Supplied so each case below fails or passes on the Firebase rule alone —
 * otherwise a missing DATABASE_URL would mask the behaviour under test.
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
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  TWILIO_ACCOUNT_SID: `AC${'e'.repeat(32)}`,
  TWILIO_AUTH_TOKEN: 'f'.repeat(32),
  TWILIO_PHONE_NUMBER: '+21612345678',
};

const SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'foodwaste-prod',
  private_key: '-----BEGIN PRIVATE KEY-----\nstub\n-----END PRIVATE KEY-----\n',
  client_email: 'sdk@foodwaste-prod.iam.gserviceaccount.com',
});

/** Firebase-specific errors only — other keys are satisfied by PRODUCTION_BASE. */
function firebaseErrors(env: Record<string, unknown>): string[] {
  const { error } = envValidationSchema.validate(env, { abortEarly: false });
  return (error?.details ?? [])
    .filter(d => String(d.path[0]).startsWith('FIREBASE'))
    .map(d => d.message);
}

describe('env validation — Firebase credentials', () => {
  describe('production', () => {
    it('accepts a service account file path', () => {
      expect(
        firebaseErrors({
          ...PRODUCTION_BASE,
          FIREBASE_SERVICE_ACCOUNT_PATH: '/etc/secrets/firebase.json',
        }),
      ).toEqual([]);
    });

    it('accepts inline service account JSON with no path set', () => {
      // The container case. This is what the deploy needed and could not do.
      expect(
        firebaseErrors({
          ...PRODUCTION_BASE,
          FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT_JSON,
        }),
      ).toEqual([]);
    });

    it('accepts both, matching the service preferring the path', () => {
      expect(
        firebaseErrors({
          ...PRODUCTION_BASE,
          FIREBASE_SERVICE_ACCOUNT_PATH: '/etc/secrets/firebase.json',
          FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT_JSON,
        }),
      ).toEqual([]);
    });

    it('rejects when neither credential source is supplied', () => {
      // The guard still has to hold, or push notifications ship unconfigured.
      const errors = firebaseErrors(PRODUCTION_BASE);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('FIREBASE_SERVICE_ACCOUNT_PATH');
      expect(errors[0]).toContain('FIREBASE_SERVICE_ACCOUNT');
    });

    it('names both options in the failure message', () => {
      // The old message named only the path, which is why the fix was to add a
      // file rather than an env var.
      const [message] = firebaseErrors(PRODUCTION_BASE);
      expect(message).toMatch(/inline/i);
    });

    it('treats an empty string as absent rather than as a credential', () => {
      // Render renders an unset variable in a group as empty, not missing.
      expect(firebaseErrors({ ...PRODUCTION_BASE, FIREBASE_SERVICE_ACCOUNT: '' })).not.toEqual([]);
    });
  });

  describe('development', () => {
    it('requires neither credential source', () => {
      expect(firebaseErrors({ NODE_ENV: 'development' })).toEqual([]);
    });

    it('still accepts either when supplied', () => {
      expect(
        firebaseErrors({
          NODE_ENV: 'development',
          FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT_JSON,
        }),
      ).toEqual([]);
    });
  });
});
