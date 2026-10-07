/**
 * PHC parameter parsing for argon2 hashes - real argon2, not a mock.
 *
 * argon2 0.45 writes the cost parameters as `m=65536,p=1,t=3`, where 0.44
 * wrote `m=65536,t=3,p=1`. Both are valid PHC strings. A parser that reads
 * them by position either throws on every new hash or, worse, swaps t and p:
 * `t=1` is below the minimum of 2, so a correct production hash would be
 * reported as too weak.
 */

import * as argon2 from 'argon2';

import { parseArgon2Hash, verifyArgon2Parameters } from '../argon2-hash.util';
import { USER_PASSWORD_HASH_OPTIONS } from '../password-hash';

const SALT_AND_HASH = 'c29tZXNhbHQ$aGFzaGhhc2hoYXNo';

describe('parseArgon2Hash', () => {
  it.each([
    ['argon2 <= 0.44 order', 'm=65536,t=3,p=1'],
    ['argon2 >= 0.45 order', 'm=65536,p=1,t=3'],
    ['any other order', 'p=1,t=3,m=65536'],
  ])('reads the cost parameters by key: %s', (_label, params) => {
    const parsed = parseArgon2Hash(`$argon2id$v=19$${params}$${SALT_AND_HASH}`);

    expect(parsed).toEqual(
      expect.objectContaining({
        variant: 'argon2id',
        version: 19,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }),
    );
  });

  it('reads a hash produced by the installed argon2 with the production options', async () => {
    // Pins the real library's output, whatever order it writes the keys in.
    const encoded = await argon2.hash('Abcdefghij1!', USER_PASSWORD_HASH_OPTIONS);

    expect(parseArgon2Hash(encoded)).toEqual(
      expect.objectContaining({
        variant: 'argon2id',
        memoryCost: USER_PASSWORD_HASH_OPTIONS.memoryCost,
        timeCost: USER_PASSWORD_HASH_OPTIONS.timeCost,
        parallelism: USER_PASSWORD_HASH_OPTIONS.parallelism,
      }),
    );
  });

  it.each([
    ['a missing key', 'm=65536,t=3'],
    ['a repeated key', 'm=65536,t=3,m=1,p=1'],
    ['an unknown key', 'm=65536,t=3,p=1,x=1'],
    ['a non-numeric value', 'm=abc,t=3,p=1'],
    ['an empty parameter list', ''],
  ])('rejects %s', (_label, params) => {
    expect(() => parseArgon2Hash(`$argon2id$v=19$${params}$${SALT_AND_HASH}`)).toThrow(
      /Invalid parameters format/,
    );
  });
});

describe('verifyArgon2Parameters', () => {
  it('judges a real production hash as meeting the minimums, with no warnings', async () => {
    // The failure mode of positional parsing on a 0.45 hash: t and p swapped,
    // t=1 < 2, so a correct hash is reported as too weak.
    const encoded = await argon2.hash('Abcdefghij1!', USER_PASSWORD_HASH_OPTIONS);
    const verdict = verifyArgon2Parameters(encoded);

    expect(verdict.meetsMinimumRequirements).toBe(true);
    expect(verdict.usesRecommendedVariant).toBe(true);
    expect(verdict.warnings).toEqual([]);
  });
});
