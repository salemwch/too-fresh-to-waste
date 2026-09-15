import { envValidationSchema } from '../env.validation';

const STRONG_A = 'a3f9c1e07b2d8456af90c3e1b7d264809fbc3e5a1d7024689acf3b1e5d708246';
const STRONG_B = '77e0b1c94da2386f05b1cd7e4a9236801fce4b7a2d80369145bce70a2f581693';

const baseEnv = {
  DATABASE_URL: 'mongodb://user:pass@localhost:27017/foodwaste',
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM_ADDRESS: 'noreply@example.com',
  BACKEND_URL: 'http://localhost:3000',
  FRONTEND_URL: 'http://localhost:3001',
  JWT_SECRET: STRONG_A,
  JWT_REFRESH_SECRET: STRONG_B,
};

const validate = (overrides: Record<string, unknown> = {}) =>
  envValidationSchema.validate({ ...baseEnv, ...overrides }, { allowUnknown: true });

describe('envValidationSchema — JWT secrets', () => {
  it('accepts two distinct strong secrets', () => {
    expect(validate().error).toBeUndefined();
  });

  it('rejects the docker-compose development JWT_SECRET', () => {
    const { error } = validate({ JWT_SECRET: 'dev_jwt_secret_please_change_in_production' });
    expect(error?.message).toMatch(/JWT_SECRET.*known development secret/);
  });

  it('rejects the docker-compose development JWT_REFRESH_SECRET', () => {
    const { error } = validate({
      JWT_REFRESH_SECRET: 'dev_jwt_refresh_secret_please_change_in_production',
    });
    expect(error?.message).toMatch(/JWT_REFRESH_SECRET.*known development secret/);
  });

  it('rejects an unreplaced .env.example placeholder', () => {
    const { error } = validate({
      JWT_SECRET: 'CHANGE_ME_generate_a_unique_64_char_hex_secret',
    });
    expect(error?.message).toMatch(/placeholder/);
  });

  // The message claimed this rule long before anything enforced it.
  it('rejects a refresh secret identical to the access secret', () => {
    const { error } = validate({ JWT_REFRESH_SECRET: STRONG_A });
    expect(error?.message).toMatch(/JWT_REFRESH_SECRET must differ from JWT_SECRET/);
  });

  it('still rejects a short secret', () => {
    const { error } = validate({ JWT_SECRET: 'tooshort' });
    expect(error?.message).toMatch(/at least 32 characters/);
  });

  it('never echoes the offending secret in the error message', () => {
    const secret = 'dev_jwt_secret_please_change_in_production';
    const { error } = validate({ JWT_SECRET: secret });
    expect(error?.message).toBeDefined();
    expect(error?.message).not.toContain(secret);
  });
});
