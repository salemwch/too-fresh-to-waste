import { isI18nKey, resolveAuthError } from '../resolveAuthError';

/**
 * `state.auth.error` carries two different kinds of string, and the whole point
 * of the resolver is that it can tell them apart without asking i18next. These
 * tests drive the discrimination directly, because getting it wrong is silent:
 * a misread sentence renders as a blank or a raw dotted path, and a misread key
 * renders English to an Arabic reader.
 */

/** Stands in for `t` - records what it was asked for and returns a marker. */
const makeT = (bundle: Record<string, string> = {}) => {
  const calls: string[] = [];
  const t = (key: string, options: { defaultValue: string }): string => {
    calls.push(key);
    return bundle[key] ?? options.defaultValue;
  };
  return { t, calls };
};

describe('isI18nKey', () => {
  it.each([
    'auth.errorServerSlow',
    'auth.errorNoConnection',
    'auth.googleSignInFailed',
    'orders.phoneNumber',
    'a.b',
    'deeply.nested.key_name',
  ])('accepts the dotted key %p', key => {
    expect(isI18nKey(key)).toBe(true);
  });

  it.each([
    ['a plain sentence', 'Invalid email or password'],
    ['a sentence ending in a period', 'Invalid email or password.'],
    ['a sentence containing a period', 'Too many attempts. Please try again later.'],
    // The reason the shape test exists: i18next reads `:` as a namespace
    // separator, so this would have become a lookup rather than text.
    ['a colon, which i18next treats as a namespace', 'Error: check the field'],
    ['a capitalised first word', 'Auth.somethingBroke'],
    ['no dot at all', 'auth'],
    ['an empty string', ''],
    ['a trailing dot', 'auth.'],
    ['a leading dot', '.auth'],
    ['internal whitespace around the dot', 'auth .errorServerSlow'],
  ])('rejects %s', (_label, value) => {
    expect(isI18nKey(value)).toBe(false);
  });
});

describe('resolveAuthError', () => {
  describe('nothing to show', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', ''],
    ])('returns null for %s', (_label, value) => {
      const { t, calls } = makeT();
      expect(resolveAuthError(t, value)).toBeNull();
      // Not merely "returns null" - it must not consult the translator either,
      // or an empty error would render whatever `t('')` happens to produce.
      expect(calls).toEqual([]);
    });
  });

  describe('backend sentences pass through untouched', () => {
    it.each([
      'Invalid email or password',
      'Please verify your email before signing in.',
      'This phone number is already registered to another account',
      'Error: check the field',
    ])('returns %p verbatim and never calls t', sentence => {
      const { t, calls } = makeT();
      expect(resolveAuthError(t, sentence)).toBe(sentence);
      expect(calls).toEqual([]);
    });
  });

  describe('client-side keys are translated', () => {
    it('returns the translation for a key present in the bundle', () => {
      const { t, calls } = makeT({
        'auth.errorServerSlow': 'Le serveur met plus de temps que d’habitude à répondre.',
      });

      expect(resolveAuthError(t, 'auth.errorServerSlow')).toBe(
        'Le serveur met plus de temps que d’habitude à répondre.',
      );
      expect(calls).toEqual(['auth.errorServerSlow']);
    });

    it('falls back to the raw key when the bundle is missing it', () => {
      // A half-added translation should be visible, not blank. The raw path is
      // ugly on purpose: it gets reported instead of silently shipping.
      const { t } = makeT({});
      expect(resolveAuthError(t, 'auth.errorNotTranslatedYet')).toBe('auth.errorNotTranslatedYet');
    });

    it('distinguishes a slow server from a dead connection', () => {
      // These two were one message before, which is the bug this whole change
      // exists for: a cold-started server was reported as the user's internet.
      const { t } = makeT({
        'auth.errorServerSlow': 'server is slow',
        'auth.errorNoConnection': 'you are offline',
      });

      expect(resolveAuthError(t, 'auth.errorServerSlow')).toBe('server is slow');
      expect(resolveAuthError(t, 'auth.errorNoConnection')).toBe('you are offline');
    });
  });

  it('follows a language change, because it resolves at render time', () => {
    const en = makeT({ 'auth.errorServerSlow': 'The server is taking longer than usual.' });
    const ar = makeT({ 'auth.errorServerSlow': 'يستغرق الخادم وقتاً أطول.' });

    expect(resolveAuthError(en.t, 'auth.errorServerSlow')).toBe(
      'The server is taking longer than usual.',
    );
    expect(resolveAuthError(ar.t, 'auth.errorServerSlow')).toBe('يستغرق الخادم وقتاً أطول.');
  });
});
