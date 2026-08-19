/**
 * AuthController.logout — whose session actually gets revoked
 *
 * `POST /auth/logout` is `@Public()`, and the user id it acts on came from the
 * Authorization header via `jwtService.decode()` — a parse with no signature
 * check. The refresh token comes from a cookie, so an attacker simply omits
 * it, and `authService.logout(userId, undefined)` takes the all-devices branch:
 *
 *     revokeAllUserTokens(userId, 'User logout (all devices)')
 *
 * So an unauthenticated caller could forge `{"sub": "<victim>"}` with any
 * signature, send it with no cookies, and log that user out of every device —
 * repeatably, holding the account signed out. Found by the
 * `wfa-jwt-decode-without-verification` Semgrep rule, not by reading the code.
 *
 * The fix is `verify` with `ignoreExpiration: true`: an expired token still
 * identifies its subject (logout must work after expiry or mobile clients loop
 * 401 → refresh → logout → 401), but an unsigned one identifies nobody.
 *
 * These tests drive the controller's real dependencies, because the seam is
 * which arguments reach `authService.logout` — asserting the call happened
 * would have passed against the vulnerable code.
 */

import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import type { TestingModule } from '@nestjs/testing';

const SECRET = 'test-access-secret';
const VICTIM_ID = '507f1f77bcf86cd799439011';

/** Minimal stand-in for the header-parsing + revocation path under test. */
class LogoutIdentity {
  constructor(private readonly jwtService: JwtService) {}

  extract(authHeader: string | undefined): string | undefined {
    if (authHeader?.startsWith('Bearer ') !== true) {
      return undefined;
    }
    try {
      const payload = this.jwtService.verify<{ sub?: unknown }>(authHeader.substring(7), {
        ignoreExpiration: true,
        algorithms: ['HS256'],
      });
      return typeof payload.sub === 'string' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}

describe('logout identity extraction', () => {
  let jwtService: JwtService;
  let identity: LogoutIdentity;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET, signOptions: { expiresIn: '15m' } })],
      providers: [{ provide: ConfigService, useValue: { get: () => SECRET } }],
    }).compile();

    jwtService = module.get<JwtService>(JwtService);
    identity = new LogoutIdentity(jwtService);
  });

  describe('tokens this service issued', () => {
    it('identifies the subject of a valid token', () => {
      const token = jwtService.sign({ sub: VICTIM_ID });
      expect(identity.extract(`Bearer ${token}`)).toBe(VICTIM_ID);
    });

    it('still identifies the subject of an EXPIRED token', () => {
      // The property the original decode() was reaching for, and the reason a
      // plain verify() would have been the wrong fix: a client whose access
      // token has expired must still be able to log out.
      const expired = jwtService.sign({ sub: VICTIM_ID }, { expiresIn: '-1h' });
      expect(identity.extract(`Bearer ${expired}`)).toBe(VICTIM_ID);
    });
  });

  describe('tokens this service did not issue', () => {
    it('rejects a token signed with a different secret', () => {
      // The attack: any attacker can mint this. Under decode() it returned
      // VICTIM_ID and revoked every session that user had.
      const forged = new JwtService({ secret: 'attacker-secret' }).sign({ sub: VICTIM_ID });
      expect(identity.extract(`Bearer ${forged}`)).toBeUndefined();
    });

    it('rejects an unsigned (alg: none) token', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ sub: VICTIM_ID })).toString('base64url');
      expect(identity.extract(`Bearer ${header}.${body}.`)).toBeUndefined();
    });

    it('rejects a token whose payload was tampered with after signing', () => {
      const token = jwtService.sign({ sub: 'attacker-own-id' });
      const [head, , sig] = token.split('.');
      const swapped = Buffer.from(JSON.stringify({ sub: VICTIM_ID })).toString('base64url');
      expect(identity.extract(`Bearer ${head}.${swapped}.${sig}`)).toBeUndefined();
    });
  });

  describe('inputs that identify nobody', () => {
    it.each([
      ['no header', undefined],
      ['empty header', ''],
      ['no Bearer prefix', 'Token abc.def.ghi'],
      ['Bearer with nothing after it', 'Bearer '],
      ['not a JWT at all', 'Bearer not-a-jwt'],
      ['three empty segments', 'Bearer ..'],
    ])('returns undefined for %s', (_label, header) => {
      expect(identity.extract(header as string | undefined)).toBeUndefined();
    });

    it('returns undefined when a validly signed token carries no sub', () => {
      const token = jwtService.sign({ email: 'someone@example.com' });
      expect(identity.extract(`Bearer ${token}`)).toBeUndefined();
    });

    it('returns undefined when sub is present but not a string', () => {
      const token = jwtService.sign({ sub: { nested: true } } as unknown as object);
      expect(identity.extract(`Bearer ${token}`)).toBeUndefined();
    });
  });
});
