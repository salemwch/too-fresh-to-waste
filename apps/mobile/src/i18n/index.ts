import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import { getLocales } from 'react-native-localize';
import 'intl-pluralrules';

import { mmkvStorage } from '@/storage/mmkv';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

const STORAGE_KEY = 'app-language';

export const SUPPORTED_LANGUAGES = {
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr' },
  fr: { label: 'French', nativeLabel: 'Français', dir: 'ltr' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
} as const;

export type AppLanguage = keyof typeof SUPPORTED_LANGUAGES;

function getStoredLanguage(): AppLanguage | undefined {
  const stored = mmkvStorage.getString(STORAGE_KEY);
  if (stored && stored in SUPPORTED_LANGUAGES) {
    return stored as AppLanguage;
  }
  return undefined;
}

export function setStoredLanguage(lang: AppLanguage): void {
  mmkvStorage.setString(STORAGE_KEY, lang);
}

function detectDeviceLanguage(): AppLanguage {
  try {
    const locales = getLocales();
    for (const locale of locales) {
      const code = locale.languageCode as string;
      if (code in SUPPORTED_LANGUAGES) {
        return code as AppLanguage;
      }
    }
  } catch {
    // react-native-localize not available (e.g. in tests)
  }
  return 'en';
}

export function getCurrentLanguage(): AppLanguage {
  return (i18next.language as AppLanguage) ?? 'en';
}

const initialLanguage = getStoredLanguage() ?? detectDeviceLanguage();

const shouldBeRTL = initialLanguage === 'ar';
if (I18nManager.isRTL !== shouldBeRTL) {
  I18nManager.forceRTL(shouldBeRTL);
  I18nManager.allowRTL(shouldBeRTL);
}

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/**
 * The configured i18next instance.
 *
 * Import this (not `i18next` directly) from non-component modules that need to
 * translate outside the React tree — importing from here guarantees the `init`
 * above has run. Inside components always prefer `useTranslation()`, which
 * re-renders on language change; this instance does not.
 */
export default i18next;
