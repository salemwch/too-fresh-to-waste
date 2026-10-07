/**
 * Why a location request failed. State and results carry the code, never a
 * sentence: the sentence is `location.errors.<code>` in the locale files,
 * resolved where it is rendered so it is always in the current language.
 *
 * Kept free of imports so anything that needs the codes (the locale chain test,
 * a screen) does not load the slice and its native location modules.
 * `i18n/__tests__/locationErrorCodes.test.ts` fails if a code is added without
 * its translation in en, fr and ar.
 */
export const LOCATION_ERROR_CODES = [
  'permissionNotGranted',
  'permissionDenied',
  'positionUnavailable',
  'timeout',
  'unknown',
  'requestFailed',
] as const;

export type LocationErrorCode = (typeof LOCATION_ERROR_CODES)[number];
