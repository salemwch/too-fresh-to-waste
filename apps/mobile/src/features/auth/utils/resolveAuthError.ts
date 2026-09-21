/**
 * Turns whatever `state.auth.error` holds into text the viewer can read.
 *
 * Auth failures arrive from two places and only one of them is translatable:
 *
 * - The **backend**, as a finished sentence ("Invalid email or password"). It is
 *   already user-facing and specific, and there is no key for it.
 * - The **client**, for failures the server never got to answer - a timeout, a
 *   dead connection, a Google token the backend rejected. Those used to be
 *   hardcoded English in the sign-in thunks, so `fr` and `ar` users were shown
 *   English every time. They now carry an i18n key instead.
 *
 * Both travel in the same `error` field, which is deliberate: a parallel
 * `errorKey` would have to be cleared at all eleven sites that assign `error`,
 * and the one site somebody forgets shows a stale message under a new failure.
 *
 * A value is treated as a key only when it *looks* like one, rather than by
 * asking i18next and seeing what comes back. That matters because i18next
 * splits on `:` for namespaces and `.` for nesting, so a backend sentence like
 * "Error: check the field." would be parsed as a lookup before failing. Testing
 * the shape first means a sentence is never handed to the translator at all.
 */

/**
 * Dotted lowerCamelCase path, e.g. `auth.errorServerSlow`.
 *
 * Requires at least one dot and forbids whitespace and `:`, so no sentence can
 * match: the shortest realistic false positive would have to be a single
 * unspaced word, a dot, then another unspaced word, with no capital first
 * letter and no trailing punctuation.
 */
const I18N_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+$/;

/**
 * Narrow structural type - avoids pulling i18next's generics into callers.
 *
 * `options` is required, not optional. i18next's `TFunction` overloads each
 * declare it as a concrete object, and under `exactOptionalPropertyTypes` an
 * `options?:` parameter here is not assignable to any of them: the caller would
 * be promising it may pass `undefined`, which no overload accepts. Requiring it
 * costs nothing, since the one call site always supplies a `defaultValue`.
 */
type Translate = (key: string, options: { defaultValue: string }) => string;

export function isI18nKey(value: string): boolean {
  return I18N_KEY_PATTERN.test(value);
}

/**
 * @param t     `t` from `useTranslation()`, so the result follows a live
 *              language change.
 * @param error The raw `state.auth.error`.
 * @returns     Translated text, the original sentence, or `null` when there is
 *              no error to show.
 */
export function resolveAuthError(t: Translate, error: string | null | undefined): string | null {
  if (error === null || error === undefined || error === '') {
    return null;
  }

  if (!isI18nKey(error)) {
    return error;
  }

  // `defaultValue` covers the key that passes the shape test but is missing
  // from the bundle - a half-added translation renders the English-ish key
  // rather than a blank row, and the raw path is visible enough to get noticed.
  return t(error, { defaultValue: error });
}
