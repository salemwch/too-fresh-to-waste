/**
 * The biometric method's name in the viewer's language.
 *
 * `BiometricAuth.getBiometricTypeName` returns English. Brand names (Touch ID,
 * Face ID, Optic ID) are the same in every language and pass through; the
 * generic ones are ordinary words and are translated.
 *
 * Takes the English name rather than the enum so this module imports nothing
 * from BiometricAuth - RootNavigator loads that lazily, and a static import
 * here would undo it.
 */

import type { Translate } from '@/i18n/translate';

const GENERIC_NAME_KEYS: Readonly<Record<string, string>> = Object.freeze({
  Fingerprint: 'biometric.fingerprint',
  'Face Unlock': 'biometric.faceUnlock',
  'Iris Scanner': 'biometric.iris',
  Biometric: 'biometric.generic',
});

export function localizeBiometricName(englishName: string, t: Translate): string {
  const key = Object.prototype.hasOwnProperty.call(GENERIC_NAME_KEYS, englishName)
    ? GENERIC_NAME_KEYS[englishName]
    : undefined;
  return key === undefined ? englishName : t(key, {});
}
