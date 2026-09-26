/**
 * What the login screen does with a failed sign-in.
 *
 * Input is what `loginAsync(...).unwrap()` rejects with: the thunk's plain
 * payload `{ message, type?, field?, isAccountLocked?, blockedUntil?,
 * validationErrors? }`, where `type` is the backend error code. It is not an
 * `AppError` - it has no `timestamp` - so it must be read as a record. The
 * screen used to gate on `isAppError`, which is always false here, and the
 * locked-account modal never opened.
 */

type LoginField = 'email' | 'password';

export type LoginFailureOutcome =
  /** Too many attempts, or a locked account: the countdown modal. */
  | { kind: 'locked'; code: string | undefined; blockedUntil: string | Date }
  /** One field is wrong: inline error on it. */
  | { kind: 'field'; code: string | undefined; field: LoginField; message: string }
  /** Request validation failed: inline errors, first message per field. */
  | {
      kind: 'fields';
      code: string | undefined;
      errors: ReadonlyArray<{ field: LoginField; message: string }>;
    }
  /** Everything else: the Redux error banner shows the backend's message. */
  | { kind: 'banner'; code: string | undefined; offerResend: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLoginField = (value: unknown): value is LoginField =>
  value === 'email' || value === 'password';

export function loginFailureOutcome(rejection: unknown): LoginFailureOutcome {
  const payload = isRecord(rejection) ? rejection : {};
  const code = typeof payload['type'] === 'string' ? payload['type'] : undefined;

  const blockedUntil = payload['blockedUntil'];
  if (
    payload['isAccountLocked'] === true &&
    ((typeof blockedUntil === 'string' && blockedUntil !== '') || blockedUntil instanceof Date)
  ) {
    return { kind: 'locked', code, blockedUntil };
  }

  const message = typeof payload['message'] === 'string' ? payload['message'] : '';
  if (isLoginField(payload['field']) && message !== '') {
    return { kind: 'field', code, field: payload['field'], message };
  }

  const validation = payload['validationErrors'];
  if (isRecord(validation)) {
    const errors: Array<{ field: LoginField; message: string }> = [];
    for (const [field, text] of Object.entries(validation)) {
      if (isLoginField(field) && typeof text === 'string' && text !== '') {
        errors.push({ field, message: text });
      }
    }
    if (errors.length > 0) {
      return { kind: 'fields', code, errors };
    }
  }

  return { kind: 'banner', code, offerResend: code === 'EMAIL_NOT_VERIFIED' };
}
