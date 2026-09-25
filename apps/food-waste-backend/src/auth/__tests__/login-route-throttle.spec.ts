/**
 * `POST /auth/login` - the route-level throttle.
 *
 * There is no global ThrottlerGuard (app.module registers none), so the
 * decorators on this method are the only per-IP request limit in front of the
 * password check. AuthSecurityService counts failures; this caps requests of
 * any outcome. Removing either decorator compiles, builds and passes every
 * other test.
 */

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthController } from '../auth.controller';

// @nestjs/throttler stores the per-throttler options under `<key><name>`.
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';

describe('POST /auth/login throttle', () => {
  const handler = AuthController.prototype.login;

  it('runs ThrottlerGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];

    expect(guards).toContain(ThrottlerGuard);
  });

  it('allows at most 10 requests per 15 minutes', () => {
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(10);
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(15 * 60 * 1000);
  });
});
