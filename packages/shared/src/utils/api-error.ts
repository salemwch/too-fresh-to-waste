/**
 * Reading an error response from the API, identically on web and mobile.
 *
 * The backend answers every error with
 *
 *   { status, code, message, params?, errors?, details?, errorId, ... }
 *
 * where `message` is already in the language the client asked for
 * (Accept-Language) and `code` is stable. Branch on `code`, show `message`.
 * Never branch on `message`: it is translated, and its wording may change.
 */

/** One invalid field of a validation error, message already translated. */
export interface ApiFieldError {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorInfo {
  /** Stable machine-readable code, e.g. `EMAIL_NOT_VERIFIED`. */
  code?: string;
  /** Human-readable, in the requested language. */
  message?: string;
  /** Client-safe extras, e.g. `blockedUntil`, `field`. */
  details: Readonly<Record<string, unknown>>;
  /** First message per field, for inline form errors. */
  fieldErrors: Readonly<Record<string, string>>;
  /** Support reference, present on every backend error. */
  errorId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** Parses an error response body. Anything unexpected yields an empty info. */
export function readApiError(body: unknown): ApiErrorInfo {
  // The API always answers with a JSON object. Anything else - a string, an
  // HTML page - came from a proxy or gateway in between (a Render 502, a
  // captive portal), and its text is not written for users. No message, so
  // the caller shows its own translated fallback.
  if (!isRecord(body)) {
    return { details: {}, fieldErrors: {} };
  }

  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(body['errors'])) {
    for (const entry of body['errors']) {
      if (!isRecord(entry)) continue;
      const field = str(entry['field']);
      const message = str(entry['message']);
      if (field && message && !(field in fieldErrors)) fieldErrors[field] = message;
    }
  }

  const code = str(body['code']);
  const message = str(body['message']);
  const errorId = str(body['errorId']);
  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(errorId ? { errorId } : {}),
    details: isRecord(body['details']) ? body['details'] : {},
    fieldErrors,
  };
}

/**
 * The code of a failed request, from an axios-style error
 * (`error.response.data.code`) or an error object that already carries one.
 */
export function apiErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  const response = error['response'];
  if (isRecord(response)) {
    const fromBody = readApiError(response['data']).code;
    if (fromBody) return fromBody;
  }
  return str(error['apiCode']) ?? str(error['errorCode']);
}
