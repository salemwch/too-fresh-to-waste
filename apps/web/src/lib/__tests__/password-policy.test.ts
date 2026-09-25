/**
 * The web change-password forms must accept exactly what the backend accepts.
 * Each form used to carry its own rule, all weaker than the server's.
 */
import { PASSWORD_MIN_LENGTH, buildPasswordRegex } from '@foodwaste/shared';

import { meetsPasswordPolicy } from '../password-policy';

describe('meetsPasswordPolicy', () => {
  it.each([
    'Abcdefghij1!',
    'Abcdefghi1!', // one short
    'Abcdef1!', // the old 8-character rule
    'abcdefghij1!',
    'ABCDEFGHIJ1!',
    'Abcdefghijk!',
    'Abcdefghij12',
    'Abcdefghij1#',
    'Abcdefghij 1!',
  ])('agrees with the backend DTO rule on %j', password => {
    const server = password.length >= PASSWORD_MIN_LENGTH && buildPasswordRegex().test(password);
    expect(meetsPasswordPolicy(password)).toBe(server);
  });

  it('accepts a password at exactly the minimum and rejects one below it', () => {
    expect(meetsPasswordPolicy('Abcdefghij1!')).toBe(true);
    expect(meetsPasswordPolicy('Abcdefghi1!')).toBe(false);
  });
});
