/**
 * The dummy password hash - real argon2, not a mock.
 *
 * Login verifies against it for an unknown email so that request costs the
 * same as a wrong password on a real account. That only holds if the dummy
 * is hashed exactly like a user password; a cheaper dummy would make unknown
 * emails measurably faster, which is the oracle it exists to remove.
 */

import * as argon2 from 'argon2';

import { loginFailureReason } from '../login-failure';
import {
  getDummyPasswordHash,
  USER_PASSWORD_HASH_OPTIONS,
  verifyUserPassword,
} from '../password-hash';

/** `$argon2id$v=19$m=65536,t=3,p=1$...` -> the parameters it was made with. */
const paramsOf = (encoded: string) => {
  const match = /^\$(argon2(?:id|i|d))\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(encoded);
  if (!match) {
    throw new Error(`not an argon2 hash: ${encoded}`);
  }
  return { variant: match[1], m: Number(match[2]), t: Number(match[3]), p: Number(match[4]) };
};

describe('getDummyPasswordHash', () => {
  it('is hashed exactly like a user password', async () => {
    const dummy = paramsOf(await getDummyPasswordHash());
    const real = paramsOf(await argon2.hash('Abcdefghij1!', USER_PASSWORD_HASH_OPTIONS));

    expect(dummy).toEqual(real);
    expect(dummy).toEqual({ variant: 'argon2id', m: 65536, t: 3, p: 1 });
  });

  it('is created once per process', async () => {
    expect(await getDummyPasswordHash()).toBe(await getDummyPasswordHash());
  });

  it('matches no password anyone could send', async () => {
    const dummy = await getDummyPasswordHash();
    for (const guess of ['', 'password', 'Abcdefghij1!', 'dummy']) {
      expect(await argon2.verify(dummy, guess)).toBe(false);
    }
  });
});

describe('verifyUserPassword (real argon2)', () => {
  const password = 'Abcdefghij1!';

  it('matches the right password and only that', async () => {
    const stored = await argon2.hash(password, USER_PASSWORD_HASH_OPTIONS);
    expect(await verifyUserPassword(stored, password)).toBe(true);
    expect(await verifyUserPassword(stored, 'Abcdefghij1?')).toBe(false);
  });

  it.each([undefined, null, ''])('no stored hash (%j) never matches', async stored => {
    expect(await verifyUserPassword(stored, password)).toBe(false);
  });

  it.each(['plain-text-password', '$2b$10$legacybcrypthashvalue', '$argon2id$v=19$broken'])(
    'a stored value argon2 cannot read (%s) is a mismatch, not a throw',
    async stored => {
      await expect(verifyUserPassword(stored, password)).resolves.toBe(false);
    },
  );
});

describe('getDummyPasswordHash after a failure', () => {
  it('tries again instead of keeping the rejected promise', async () => {
    await jest.isolateModulesAsync(async () => {
      const real = jest.requireActual<typeof argon2>('argon2');
      const hash = jest
        .fn()
        .mockRejectedValueOnce(new Error('out of memory'))
        .mockImplementation(async (plain: string, options: argon2.Options) => {
          const hashed = await real.hash(plain, options);
          return hashed;
        });
      jest.doMock('argon2', () => ({ ...real, hash }));
      const fresh = await import('../password-hash');

      await expect(fresh.getDummyPasswordHash()).rejects.toThrow('out of memory');
      await expect(fresh.getDummyPasswordHash()).resolves.toMatch(/^\$argon2id\$/);
    });
  });
});

describe('loginFailureReason', () => {
  it.each([
    [null, false, 'USER_NOT_FOUND'],
    [null, true, 'USER_NOT_FOUND'],
    [{ password: undefined }, true, 'SOCIAL_LOGIN_ONLY'],
    [{ password: null }, false, 'SOCIAL_LOGIN_ONLY'],
    [{ password: '$argon2id$...' }, false, 'INVALID_PASSWORD'],
    [{ password: '$argon2id$...' }, true, null],
  ])('%j with match=%s -> %s', (user, matches, expected) => {
    expect(loginFailureReason(user as { password?: string | null } | null, matches)).toBe(expected);
  });
});
