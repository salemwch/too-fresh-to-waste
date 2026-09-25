/**
 * Validation Schemas
 *
 * Every schema is built from `t`, so its messages are in the viewer's language.
 * They used to be English literals, which meant a French or Arabic user filling
 * in the sign-in, register or reset form saw every validation error in English.
 * Screens build their schema with `useMemo(() => createXSchema(t), [t])`.
 *
 * Password rules come from the shared policy (`@foodwaste/shared`), the same
 * constants the backend DTOs validate against. The previous local copy accepted
 * characters the backend rejects (`#`, spaces, accented letters), so the form
 * passed and the user got the server's English error instead.
 */

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SPECIAL_CHARS,
  buildSpecialCharRegex,
  escapeRegexCharClass,
} from '@foodwaste/shared';
import * as yup from 'yup';

import type { Translate } from '@/i18n/translate';

/**
 * Letters in every script the app serves - Latin with its accents, and Arabic -
 * plus spaces, hyphens and both apostrophes (iOS types the curly one).
 *
 * Explicit ranges instead of `\p{L}`, which depends on the JS engine's Unicode
 * property support. The backend accepts any 2-50 character name, so this is a
 * typo guard, not a policy: it must never reject a real name. The old pattern
 * was `[a-zA-Z]`, which refused "Hélène" and every name written in Arabic.
 */
export const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ɏ؀-ۿݐ-ݿ\s'’-]+$/;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 50;

/** Characters the backend's `buildPasswordRegex()` allows, and nothing else. */
const PASSWORD_ALLOWED_CHARS = new RegExp(
  `^[A-Za-z\\d${escapeRegexCharClass(PASSWORD_SPECIAL_CHARS)}]+$`,
);

// ─── Field rules ─────────────────────────────────────────────────────────────

export const emailRule = (t: Translate) =>
  yup
    .string()
    .required(t('validation.emailRequired', {}))
    .email(t('validation.emailInvalid', {}))
    .lowercase()
    .trim()
    .test('valid-tld', t('validation.emailInvalid', {}), value => {
      if (!value) return false;
      // A TLD of at least 2 characters after the last dot.
      const tldMatch = value.match(/\.([a-z]{2,})$/i);
      return tldMatch?.[1] !== undefined && tldMatch[1].length >= 2;
    });

/** A new password, checked against the shared policy the backend enforces. */
export const passwordRule = (t: Translate) =>
  yup
    .string()
    .required(t('validation.passwordRequired', {}))
    .min(PASSWORD_MIN_LENGTH, t('validation.passwordMin', { min: PASSWORD_MIN_LENGTH }))
    .max(PASSWORD_MAX_LENGTH, t('validation.passwordMax', { max: PASSWORD_MAX_LENGTH }))
    .matches(/[A-Z]/, t('validation.passwordUppercase', {}))
    .matches(/[a-z]/, t('validation.passwordLowercase', {}))
    .matches(/[0-9]/, t('validation.passwordNumber', {}))
    .matches(
      buildSpecialCharRegex(),
      t('validation.passwordSpecial', { chars: PASSWORD_SPECIAL_CHARS }),
    )
    .matches(
      PASSWORD_ALLOWED_CHARS,
      t('validation.passwordAllowedChars', { chars: PASSWORD_SPECIAL_CHARS }),
    );

/** One-line summary of `passwordRule`, for the hint under a password field. */
export const passwordHint = (t: Translate): string =>
  t('validation.passwordHint', { min: PASSWORD_MIN_LENGTH, chars: PASSWORD_SPECIAL_CHARS });

/** `requiredKey` names the field, so each language can phrase it properly. */
export const nameRule = (t: Translate, requiredKey: string) =>
  yup
    .string()
    .required(t(requiredKey, {}))
    .trim()
    .min(NAME_MIN_LENGTH, t('validation.minChars', { min: NAME_MIN_LENGTH }))
    .max(NAME_MAX_LENGTH, t('validation.maxChars', { max: NAME_MAX_LENGTH }))
    .matches(NAME_PATTERN, t('validation.nameLetters', {}));

// ─── Auth schemas ────────────────────────────────────────────────────────────

export const createLoginSchema = (t: Translate) =>
  yup.object({
    email: emailRule(t),
    password: yup.string().required(t('validation.passwordRequired', {})),
    rememberMe: yup.boolean(),
  });

// Mobile registration (phoneNumber is deferred to order placement).
export const createRegisterMobileSchema = (t: Translate) =>
  yup.object({
    firstName: nameRule(t, 'validation.firstNameRequired'),
    lastName: nameRule(t, 'validation.lastNameRequired'),
    email: emailRule(t),
    password: passwordRule(t),
  });

/** Email only - forgot password and resend verification. */
export const createEmailSchema = (t: Translate) =>
  yup.object({
    email: emailRule(t),
  });

export const createForgotPasswordSchema = createEmailSchema;

export const createResetPasswordSchema = (t: Translate) =>
  yup.object({
    password: passwordRule(t),
  });

// ─── Types ───────────────────────────────────────────────────────────────────

export type LoginFormData = yup.InferType<ReturnType<typeof createLoginSchema>>;
export type RegisterMobileFormData = yup.InferType<ReturnType<typeof createRegisterMobileSchema>>;
export type EmailFormData = yup.InferType<ReturnType<typeof createEmailSchema>>;
export type ForgotPasswordFormData = EmailFormData;
export type ResetPasswordFormData = yup.InferType<ReturnType<typeof createResetPasswordSchema>>;
