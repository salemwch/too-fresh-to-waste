import { envValidationSchema } from '../../../config/env.validation';
import {
  JWT_EXPIRES_IN_DEFAULT,
  JWT_REFRESH_EXPIRES_IN_DEFAULT,
} from '../../../config/token-lifetimes';
import { CookieSecurityUtil, SESSION_COOKIE_MAX_AGE_MS } from '../cookie-security.util';

/**
 * The pre-existing spec asserted only `toHaveProperty('tokenLifetime')`, which
 * is why `refreshToken: '365 days'` survived long after the real default moved
 * to 30d. These assert the values, and assert them against the schema rather
 * than against a second copy of the literal.
 */
describe('getSecurityConfig — tokenLifetime reflects real configuration', () => {
  const saved = {
    access: process.env['JWT_EXPIRES_IN'],
    refresh: process.env['JWT_REFRESH_EXPIRES_IN'],
  };

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  afterEach(() => {
    restore('JWT_EXPIRES_IN', saved.access);
    restore('JWT_REFRESH_EXPIRES_IN', saved.refresh);
  });

  it('never reports the removed 365-day refresh lifetime', () => {
    delete process.env['JWT_REFRESH_EXPIRES_IN'];
    const { tokenLifetime } = CookieSecurityUtil.getSecurityConfig(true);
    expect(tokenLifetime.refreshToken).not.toMatch(/365/);
  });

  it('falls back to the same default the Joi schema applies', () => {
    delete process.env['JWT_REFRESH_EXPIRES_IN'];
    delete process.env['JWT_EXPIRES_IN'];

    // What the validated configuration would actually produce.
    const { value } = envValidationSchema.validate(
      {
        DATABASE_URL: 'mongodb://u:p@localhost:27017/db',
        RESEND_API_KEY: 're_test_key',
        EMAIL_FROM_ADDRESS: 'noreply@example.com',
        BACKEND_URL: 'http://localhost:3000',
        FRONTEND_URL: 'http://localhost:3001',
        JWT_SECRET: 'a3f9c1e07b2d8456af90c3e1b7d264809fbc3e5a1d7024689acf3b1e5d708246',
        JWT_REFRESH_SECRET: '77e0b1c94da2386f05b1cd7e4a9236801fce4b7a2d80369145bce70a2f581693',
      },
      { allowUnknown: true },
    );

    const { tokenLifetime } = CookieSecurityUtil.getSecurityConfig(true);
    expect(tokenLifetime.refreshToken).toBe(value.JWT_REFRESH_EXPIRES_IN);
    expect(tokenLifetime.accessToken).toBe(value.JWT_EXPIRES_IN);
    // and those are the shared constants, not a private copy
    expect(tokenLifetime.refreshToken).toBe(JWT_REFRESH_EXPIRES_IN_DEFAULT);
    expect(tokenLifetime.accessToken).toBe(JWT_EXPIRES_IN_DEFAULT);
  });

  it('reports an overridden lifetime rather than the default', () => {
    process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
    process.env['JWT_EXPIRES_IN'] = '5m';
    const { tokenLifetime } = CookieSecurityUtil.getSecurityConfig(true);
    expect(tokenLifetime.refreshToken).toBe('7d');
    expect(tokenLifetime.accessToken).toBe('5m');
  });

  it('reports the session lifetime actually applied by setSessionCookie', () => {
    const { tokenLifetime } = CookieSecurityUtil.getSecurityConfig(true);
    expect(tokenLifetime.session).toBe(`${SESSION_COOKIE_MAX_AGE_MS}ms`);
    expect(SESSION_COOKIE_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
