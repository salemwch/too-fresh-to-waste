/**
 * Which registration form field a failed registration belongs to.
 *
 * Decided by the backend's error `code`, never by searching the message for
 * "email" or "password": the message is translated (fr / ar), so a text search
 * only ever worked in English - and even there it sent "email service
 * unavailable" to the email field.
 */

export type RegisterField = 'email' | 'password' | 'firstName' | 'lastName';

export interface RegisterFailure {
  /** Backend code, e.g. `EMAIL_ALREADY_REGISTERED`. */
  code?: string;
  /** Translated message from the backend. */
  message?: string;
  /** Translated message per invalid field, from a VALIDATION_FAILED response. */
  validationErrors?: Readonly<Record<string, string>>;
}

const FIELD_BY_CODE: Readonly<Record<string, RegisterField>> = {
  EMAIL_ALREADY_REGISTERED: 'email',
  USER_ALREADY_EXISTS: 'email',
  EMAIL_REQUIRED: 'email',
  PASSWORD_POLICY: 'password',
  PASSWORD_REQUIRED: 'password',
  FIRST_NAME_REQUIRED: 'firstName',
  LAST_NAME_REQUIRED: 'lastName',
};

const FORM_FIELDS: readonly RegisterField[] = ['email', 'password', 'firstName', 'lastName'];

/** Inline errors for the form, keyed by field. Empty when none belong to a field. */
export function registerFieldErrors(
  failure: RegisterFailure,
): Partial<Record<RegisterField, string>> {
  const out: Partial<Record<RegisterField, string>> = {};
  for (const [field, message] of Object.entries(failure.validationErrors ?? {})) {
    if ((FORM_FIELDS as readonly string[]).includes(field) && message) {
      out[field as RegisterField] = message;
    }
  }
  const field = failure.code ? FIELD_BY_CODE[failure.code] : undefined;
  if (field && failure.message && out[field] === undefined) out[field] = failure.message;
  return out;
}

/** Whether the failure is shown on a field rather than in the global banner. */
export function isRegisterFieldError(failure: RegisterFailure): boolean {
  return Object.keys(registerFieldErrors(failure)).length > 0;
}
