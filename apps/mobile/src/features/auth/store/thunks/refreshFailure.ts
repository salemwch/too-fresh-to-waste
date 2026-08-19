/**
 * Classification of a failed token refresh.
 *
 * Extracted from `refreshTokenAsync`'s catch block so the decision can be
 * tested exhaustively. It is the most consequential branch in the mobile app:
 * one of its outputs causes `SecureStorage.clearAll()` and signs the user out.
 *
 * The rule it encodes is that clearing a session requires **positive evidence**
 * that the server rejected the refresh token. Every other failure — offline,
 * 5xx, timeout, an unexpected throw, or the Keychain not being readable yet
 * during cold-start recovery — leaves the token untested, and an untested token
 * is not a dead one.
 *
 * The two outcomes are not symmetric. Preserving a session that is genuinely
 * dead costs one more 401, which the interceptor already handles. Clearing one
 * that was alive costs the user their login, silently, with no way back but to
 * sign in again. The asymmetry sets the default.
 */

export interface RefreshFailure {
  /** User-facing-ish message, defaulted when the error carried none. */
  message: string;
  /**
   * Transient: device offline, DNS failure, timeout, or a 5xx. The session is
   * still valid — the server was simply unreachable.
   */
  isNetworkError: boolean;
  /** The account itself is suspended (403 / ACCOUNT_SUSPENDED). */
  isAccountSuspended: boolean;
  /**
   * The server positively rejected the refresh token. The ONLY value that may
   * cost the user their session.
   */
  isTokenRejected: boolean;
}

/** Thrown by the thunk when the Keychain holds no refresh token to send. */
export const NO_REFRESH_TOKEN = 'No refresh token available';

const DEFAULT_MESSAGE = 'Token refresh failed';

/** Message, from an AppError shape or a plain Error. */
function extractMessage(error: unknown): string {
  if (error !== null && error !== undefined && typeof error === 'object') {
    const message = (error as Record<string, unknown>)['message'];
    if (typeof message === 'string' && message !== '') return message;
  }
  if (error instanceof Error && error.message !== '') return error.message;
  return DEFAULT_MESSAGE;
}

function extractStatusCode(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const code = (error as Record<string, unknown>)['code'];
  return typeof code === 'number' ? code : undefined;
}

function extractErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const errorCode = (error as Record<string, unknown>)['errorCode'];
  return typeof errorCode === 'string' ? errorCode : undefined;
}

function extractType(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const type = (error as Record<string, unknown>)['type'];
  return typeof type === 'string' ? type : undefined;
}

export function classifyRefreshFailure(error: unknown): RefreshFailure {
  const message = extractMessage(error);
  const statusCode = extractStatusCode(error);
  const errorCode = extractErrorCode(error);
  const type = extractType(error);
  const lowerMessage = message.toLowerCase();

  // Network / server problems keep the session alive: the server had no chance
  // to pass judgement on the token.
  const isNetworkError =
    message === 'Network request failed' ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('econnaborted') ||
    (statusCode !== undefined && statusCode >= 500 && statusCode < 600) ||
    type === 'NETWORK' ||
    type === 'SERVER_ERROR';

  const isAccountSuspended =
    statusCode === 403 ||
    errorCode === 'ACCOUNT_SUSPENDED' ||
    lowerMessage.includes('no longer active');

  /*
   * A refresh we could not even attempt has tested nothing.
   *
   * This is the cold-start race: recovery is in flight, the Keychain has not
   * been written yet, and the thunk throws before any request leaves the
   * device. It is neither a network error nor a rejection — under the previous
   * "not network ⇒ fatal" inference it fell through to the destructive branch
   * and signed out users whose sessions were perfectly valid.
   */
  const couldNotAttempt = message === NO_REFRESH_TOKEN;

  const isTokenRejected =
    !couldNotAttempt && !isNetworkError && (statusCode === 401 || isAccountSuspended);

  return { message, isNetworkError, isAccountSuspended, isTokenRejected };
}
