/**
 * Validation schemas - what a user can type, and what they are told.
 *
 * Two regressions this pins down:
 * - Names written in Arabic, or with accents, were refused by the profile form.
 *   The backend accepts any 2-50 characters, so the client must never be the
 *   one that turns a real name away.
 * - Password rules drifted from the backend policy, so the form passed
 *   characters the server rejects. `passwordRule` now mirrors
 *   `buildPasswordRegex()`; the parity case below drives both from one table.
 */

import { buildPasswordRegex, PASSWORD_MIN_LENGTH } from '@foodwaste/shared';
import i18next from 'i18next';

import ar from '../../../i18n/locales/ar.json';
import fr from '../../../i18n/locales/fr.json';
import {
  NAME_PATTERN,
  createEmailSchema,
  createRegisterMobileSchema,
  createResetPasswordSchema,
} from '../schemas';

const tIn = (lng: string) => (key: string, options: Record<string, string | number>) =>
  i18next.t(key, { ...options, lng });

beforeAll(() => {
  i18next.addResourceBundle('fr', 'translation', fr, true, true);
  i18next.addResourceBundle('ar', 'translation', ar, true, true);
});

const firstError = async (run: () => Promise<unknown>): Promise<string | null> => {
  try {
    await run();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

describe('NAME_PATTERN', () => {
  it.each([
    'Salem',
    'Hélène',
    'Zoë',
    "O'Brien",
    'O’Brien',
    'Jean-Luc',
    'محمد',
    'عبد الله',
    'Ben Ali',
  ])('accepts %s', name => {
    expect(NAME_PATTERN.test(name)).toBe(true);
  });

  it.each(['12345', 'John3', 'a@b', '<script>', ''])('rejects %j', name => {
    expect(NAME_PATTERN.test(name)).toBe(false);
  });
});

describe('password rule parity with the backend policy', () => {
  const valid = 'Abcdefghij1!';
  const schema = createResetPasswordSchema(tIn('en'));

  it.each([
    valid,
    'Abcdefghij1#', // '#' is not in PASSWORD_SPECIAL_CHARS
    'Abcdefghij 1!', // space
    'Abcdéfghij1!', // accented letter
    'abcdefghij1!', // no uppercase
    'ABCDEFGHIJ1!', // no lowercase
    'Abcdefghijk!', // no digit
    'Abcdefghij12', // no special
    'Abc1!', // too short
  ])('client and server agree on %j', async password => {
    const clientAccepts = (await firstError(() => schema.validate({ password }))) === null;
    const serverAccepts =
      buildPasswordRegex().test(password) && password.length >= PASSWORD_MIN_LENGTH;
    expect(clientAccepts).toBe(serverAccepts);
  });
});

describe('messages follow the viewer language', () => {
  it.each([
    ['en', 'Email is required'],
    ['fr', fr.validation.emailRequired],
    ['ar', ar.validation.emailRequired],
  ])('%s: empty email', async (lng, expected) => {
    const message = await firstError(() => createEmailSchema(tIn(lng)).validate({ email: '' }));
    expect(message).toBe(expected);
  });

  it('interpolates the policy minimum rather than showing a placeholder', async () => {
    const message = await firstError(() =>
      createResetPasswordSchema(tIn('fr')).validate({ password: 'Ab1!' }),
    );
    expect(message).toContain(String(PASSWORD_MIN_LENGTH));
    expect(message).not.toContain('{{');
  });

  it('names the field that is missing', async () => {
    const message = await firstError(() =>
      createRegisterMobileSchema(tIn('en')).validate({
        firstName: 'Salem',
        lastName: '',
        email: 'a@b.tn',
        password: 'Abcdefghij1!',
      }),
    );
    expect(message).toBe('Last name is required');
  });
});
