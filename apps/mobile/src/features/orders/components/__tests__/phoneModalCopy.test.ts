import i18next from 'i18next';

import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

/**
 * Copy shown by PhoneVerificationModal, checked against the real bundles
 * through a real i18next instance.
 *
 * Two failure modes this is here for, both of which render *something* and so
 * survive a type-check, a build and a snapshot:
 *
 * 1. **A missing key renders as its own path.** `orders.phoneSaveFailed` would
 *    appear literally, in the one locale nobody on the team reads.
 * 2. **An unresolved placeholder renders as `{{digits}}`.** These strings take
 *    an interpolation value, and the variable is deliberately *not* called
 *    `count` - i18next treats `count` as a pluralisation trigger, and Arabic
 *    has six plural categories, so `count` would demand `_zero/_one/_two/
 *    _few/_many/_other` variants of every string or fall back unpredictably.
 *    Asserting the rendered output is what makes that choice verifiable rather
 *    than a comment.
 *
 * The modal collects a phone number and PATCHes the profile. No OTP is sent -
 * SMS_ENABLED is false - so the copy must not promise a code.
 */

const PHONE_LOCAL_DIGITS = 8;

/** Every key the modal renders. */
const PLAIN_KEYS = [
  'orders.enterPhoneTitle',
  'orders.enterPhoneSubtitle',
  'orders.phoneNumber',
  'orders.phonePlaceholder',
  'orders.a11yPhoneInput',
  'orders.phoneSaveFailed',
  'common.confirm',
  'common.cancel',
];

const INTERPOLATED_KEYS = ['orders.phoneInvalidLength', 'orders.a11yPhoneInputHint'];

/** Words that would promise an OTP the app never sends. */
const OTP_WORDS = /\b(otp|verification code|code de vérification|رمز التحقق)\b/i;

beforeAll(async () => {
  await i18next.init({
    resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

describe.each(['en', 'fr', 'ar'])('%s', locale => {
  beforeEach(async () => {
    await i18next.changeLanguage(locale);
  });

  it.each(PLAIN_KEYS)('renders %s as real text', key => {
    const rendered = i18next.t(key);

    expect(rendered).not.toBe(key);
    expect(rendered.trim()).not.toBe('');
  });

  it.each(INTERPOLATED_KEYS)('substitutes the digit count into %s', key => {
    const rendered = i18next.t(key, { digits: PHONE_LOCAL_DIGITS });

    expect(rendered).not.toBe(key);
    // The actual assertion: no placeholder survived into the UI.
    expect(rendered).not.toContain('{{');
    expect(rendered).toContain(String(PHONE_LOCAL_DIGITS));
  });

  it('does not promise a verification code anywhere in the modal', () => {
    // OTP is off. Copy that mentions a code would leave the user waiting for
    // an SMS that is never sent - and the modal closes straight into the order.
    const allCopy = [...PLAIN_KEYS, ...INTERPOLATED_KEYS]
      .map(k => i18next.t(k, { digits: PHONE_LOCAL_DIGITS }))
      .join(' ');

    expect(allCopy).not.toMatch(OTP_WORDS);
  });

  if (locale !== 'en') {
    it('is actually translated, not the English copy left in place', () => {
      const untranslated = PLAIN_KEYS.filter(k => {
        const localised = i18next.t(k);
        const english = i18next.getFixedT('en')(k);
        return localised === english;
      });

      // `phonePlaceholder` is the sample number "20 123 456" - identical in
      // every locale by design, so it is expected here and nothing else is.
      expect(untranslated).toEqual(['orders.phonePlaceholder']);
    });
  }
});
