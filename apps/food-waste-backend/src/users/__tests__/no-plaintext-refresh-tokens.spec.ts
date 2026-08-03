/**
 * The user document must never carry refresh tokens in plaintext.
 *
 * `users.refreshTokens` held raw refresh tokens as strings. It was written on
 * login and logout and read by nothing — authentication runs entirely against
 * the `RefreshToken` collection, which stores a SHA-256 hash plus rotation,
 * family-theft detection and TTLs.
 *
 * It was still a real exposure: validation hashes whatever token is presented
 * and looks the hash up, so a raw value lifted from a database dump is a
 * working credential until it expires. The field bought nothing in exchange.
 *
 * These tests pin the removal so it cannot quietly come back — the tempting
 * reintroduction is "just store the token so we can list sessions", which is
 * exactly what the RefreshToken collection already does safely.
 */

import { UserSchema } from '../schemas/user.schema';

import { RefreshTokenSchema } from '../../auth/schemas/refresh-token.schema';

describe('User schema — no plaintext credential storage', () => {
  it('declares no refreshTokens path', () => {
    expect(UserSchema.path('refreshTokens')).toBeUndefined();
  });

  it('strips refreshTokens from a write instead of persisting it', () => {
    // Mongoose strict mode silently drops paths the schema does not declare.
    // That is what makes the removal self-enforcing: even a leftover write site
    // cannot put a token back into the document.
    const UserModel = require('mongoose').model('NoPlaintextTokenProbe', UserSchema);
    const doc = new UserModel({
      email: 'probe@example.com',
      refreshTokens: ['a-very-real-looking.jwt.value'],
    });

    expect((doc as unknown as Record<string, unknown>)['refreshTokens']).toBeUndefined();
    expect(JSON.stringify(doc.toObject())).not.toContain('a-very-real-looking.jwt.value');
  });

  it('declares no other path that could hold a raw token', () => {
    // Guards against the field reappearing under a different name.
    const suspicious = Object.keys(UserSchema.paths).filter(path =>
      /^refreshTokens?$|^tokens$|^jwt/i.test(path),
    );

    expect(suspicious).toEqual([]);
  });
});

describe('RefreshToken schema — the store that replaced it', () => {
  it('stores a hash, not the token itself', () => {
    expect(RefreshTokenSchema.path('tokenHash')).toBeDefined();
    expect(RefreshTokenSchema.path('token')).toBeUndefined();
  });

  it('requires the hash — a record without one would authenticate nothing', () => {
    expect(RefreshTokenSchema.path('tokenHash').isRequired).toBe(true);
  });

  it('supports per-session revocation, which the array never did', () => {
    // The array was replaced wholesale on every login (`$set: [token]`), so it
    // could not represent more than one session even in principle.
    expect(RefreshTokenSchema.path('isRevoked')).toBeDefined();
    expect(RefreshTokenSchema.path('jti')).toBeDefined();
    expect(RefreshTokenSchema.path('familyId')).toBeDefined();
  });

  it('expires records automatically via a TTL index', () => {
    // A plaintext array had no expiry: a token stayed in the document until
    // something overwrote it, long after the JWT itself had died.
    const indexes = RefreshTokenSchema.indexes();
    const ttlOnExpiresAt = indexes.find(
      ([fields, options]) =>
        (fields as Record<string, unknown>)['expiresAt'] !== undefined &&
        (options as Record<string, unknown> | undefined)?.['expireAfterSeconds'] !== undefined,
    );

    expect(ttlOnExpiresAt).toBeDefined();
  });
});
