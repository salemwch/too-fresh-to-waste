import {
  isErrorCode,
  localizeError,
  type ErrorCode,
  type ErrorLocale,
  type ErrorParams,
} from './app-error';
import type { FieldError } from './validation-errors';

/** What a client receives about an error, besides status and tracing ids. */
export interface ClientError {
  /** Stable, machine-readable. Clients branch on this, never on `message`. */
  code: string;
  /** In the requester's language whenever the code is in the catalogue. */
  message: string;
  params?: ErrorParams;
  /** Validation failures, one per failing constraint, each translated. */
  errors?: Array<FieldError & { message: string }>;
  /** Client-safe extras, e.g. `blockedUntil` on a locked account. */
  details?: Record<string, unknown>;
}

/** Nest and Express defaults, which say nothing a user can act on. */
const FRAMEWORK_DEFAULTS: Readonly<Record<string, ErrorCode>> = {
  Unauthorized: 'UNAUTHORIZED',
  'Forbidden resource': 'FORBIDDEN',
  Forbidden: 'FORBIDDEN',
  'Not Found': 'NOT_FOUND',
  'Bad Request': 'BAD_REQUEST',
  Conflict: 'CONFLICT',
  Gone: 'GONE',
  'Too Many Requests': 'TOO_MANY_REQUESTS',
  'ThrottlerException: Too Many Requests': 'TOO_MANY_REQUESTS',
  'Payload Too Large': 'PAYLOAD_TOO_LARGE',
  'request entity too large': 'PAYLOAD_TOO_LARGE',
  'Method Not Allowed': 'METHOD_NOT_ALLOWED',
  'Unprocessable Entity': 'UNPROCESSABLE',
  'Request Timeout': 'TIMEOUT',
  'Internal Server Error': 'INTERNAL_ERROR',
  'Service Unavailable': 'SERVICE_UNAVAILABLE',
};

const ROUTE_NOT_FOUND = /^Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) \//;

/** The code a response carries when nothing more specific was thrown. */
const STATUS_CODES: Readonly<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  502: 'SERVICE_UNAVAILABLE',
  503: 'SERVICE_UNAVAILABLE',
  504: 'TIMEOUT',
};

/**
 * Top-level fields older throw sites put next to `message`, that clients read.
 * An allowlist, not everything that is not reserved: some sites attach
 * internal detail (a raw error message, stats) that must never reach a user.
 */
const LEGACY_DETAIL_KEYS = [
  'blockedUntil',
  'attemptsRemaining',
  'remainingAttempts',
  'field',
  'type',
  'feedback',
  'lockedUntil',
] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFieldError = (value: unknown): value is FieldError =>
  isPlainObject(value) && typeof value['field'] === 'string' && isErrorCode(value['code']);

/**
 * Turns an exception's response body into what the client receives.
 *
 * @param body       `HttpException.getResponse()`, or undefined for a non-HTTP error
 * @param rawMessage the English message the filter extracted (and logs)
 */
export function toClientError(input: {
  body: unknown;
  rawMessage: string;
  status: number;
  locale: ErrorLocale;
  isProduction: boolean;
}): ClientError {
  const { body, rawMessage, status, locale, isProduction } = input;
  const obj = isPlainObject(body) ? body : undefined;

  const explicit: ErrorCode | undefined = isErrorCode(obj?.['code'])
    ? obj['code']
    : isErrorCode(rawMessage) // older sites threw the code as the message
      ? rawMessage
      : (FRAMEWORK_DEFAULTS[rawMessage] ??
        (ROUTE_NOT_FOUND.test(rawMessage) ? 'ROUTE_NOT_FOUND' : undefined));

  // A code string outside the catalogue is still passed on: clients may branch on it.
  const unknownCode = typeof obj?.['code'] === 'string' && !explicit ? obj['code'] : undefined;
  const code =
    explicit ??
    unknownCode ??
    STATUS_CODES[status] ??
    (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');

  const params = isPlainObject(obj?.['params']) ? (obj['params'] as ErrorParams) : undefined;

  const errors = Array.isArray(obj?.['errors'])
    ? (obj['errors'] as unknown[]).filter(isFieldError).map(e => ({
        ...e,
        message: localizeError(e.code, locale, e.params),
      }))
    : undefined;

  const details: Record<string, unknown> = {};
  if (status < 500) {
    if (isPlainObject(obj?.['details'])) {
      Object.assign(details, obj['details']);
    }
    for (const key of LEGACY_DETAIL_KEYS) {
      if (obj?.[key] !== undefined) {
        details[key] = obj[key];
      }
    }
  }

  let message: string;
  if (explicit === 'VALIDATION_FAILED' && errors?.length === 1 && errors[0]) {
    // One bad field: say what it is, not "some details are not valid".
    message = errors[0].message;
  } else if (explicit) {
    message = localizeError(explicit, locale, params);
  } else if (status >= 500 && isProduction) {
    message = localizeError('INTERNAL_ERROR_WITH_ID', locale);
  } else {
    // A throw site not yet migrated to a code: its English text, unchanged.
    message = rawMessage;
  }

  return {
    code,
    message,
    ...(params ? { params } : {}),
    ...(errors && errors.length > 0 ? { errors } : {}),
    ...(Object.keys(details).length > 0 ? { details } : {}),
  };
}
