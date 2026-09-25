import { AR } from './catalog/ar';
import { EN, type ErrorCode } from './catalog/en';
import { FR } from './catalog/fr';

export type { ErrorCode };

export type ErrorLocale = 'en' | 'fr' | 'ar';

/** Values interpolated into `{name}` placeholders. */
export type ErrorParams = Readonly<Record<string, string | number>>;

/**
 * The response body of an HTTP exception thrown with a code.
 *
 * `message` is the English text, so everything that reads `exception.message`
 * inside the backend (logs, listeners, retries, tests) keeps working. The
 * client gets the message in its own language - the exception filter replaces
 * it using `code` and `params`.
 */
export interface AppErrorBody {
  code: ErrorCode;
  message: string;
  params?: ErrorParams;
  /** Extra, client-safe fields (e.g. `blockedUntil` on a locked account). */
  details?: Readonly<Record<string, unknown>>;
}

const CATALOGS: Readonly<Record<ErrorLocale, Readonly<Record<ErrorCode, string>>>> = {
  en: EN,
  fr: FR,
  ar: AR,
};

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EN, value);

/**
 * Fills `{name}` placeholders. A placeholder without a value is left visible
 * rather than rendered as "undefined", so a missing param is noticed.
 */
export function formatErrorMessage(template: string, params?: ErrorParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

/** The message for a code in the given language. */
export function localizeError(code: ErrorCode, locale: ErrorLocale, params?: ErrorParams): string {
  return formatErrorMessage(CATALOGS[locale][code], params);
}

/**
 * The argument to pass to a Nest HTTP exception:
 *
 *   throw new NotFoundException(appError('ORDER_NOT_FOUND'));
 *   throw new BadRequestException(appError('DATE_RANGE_TOO_LONG', { maxDays: 90 }));
 *
 * The exception class still decides the HTTP status; the code decides what the
 * user reads.
 */
export function appError(
  code: ErrorCode,
  params?: ErrorParams,
  details?: Readonly<Record<string, unknown>>,
): AppErrorBody {
  return {
    code,
    message: localizeError(code, 'en', params),
    ...(params ? { params } : {}),
    ...(details ? { details } : {}),
  };
}

/**
 * The language to answer in, from `Accept-Language`. The first supported
 * language wins, in the order the client listed them (quality values are
 * ignored: every client this backend serves sends a single tag). Anything
 * else - no header, `de-DE`, `*` - is English.
 */
export function resolveErrorLocale(header: string | string[] | undefined): ErrorLocale {
  const raw = Array.isArray(header) ? header.join(',') : (header ?? '');
  for (const part of raw.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase() ?? '';
    if (tag.startsWith('ar')) {
      return 'ar';
    }
    if (tag.startsWith('fr')) {
      return 'fr';
    }
    if (tag.startsWith('en')) {
      return 'en';
    }
  }
  return 'en';
}

/**
 * Whether an error was thrown with this code. Check this, never
 * `error.message === '...'`: the English copy is allowed to change, the code
 * is not.
 */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
  const response =
    typeof error === 'object' && error !== null && 'getResponse' in error
      ? (error as { getResponse: () => unknown }).getResponse()
      : undefined;
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as { code?: unknown }).code === code
  );
}
