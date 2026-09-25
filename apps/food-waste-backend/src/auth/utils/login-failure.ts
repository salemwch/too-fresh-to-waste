/**
 * Why a login attempt was rejected before the password was proven - for logs,
 * audit and monitoring only. The client always receives the same
 * INVALID_CREDENTIALS response, whatever the reason: telling them apart would
 * let anyone probe which emails have accounts, and how they sign in.
 */
export type LoginFailureReason = 'USER_NOT_FOUND' | 'SOCIAL_LOGIN_ONLY' | 'INVALID_PASSWORD';

/**
 * The internal reason a credential check failed, or `null` when the password
 * is proven for an existing account with a password.
 *
 * `passwordMatches` must come from verifying against the account's hash - or
 * the dummy hash when there is no account or no password - so every branch
 * has done the same work before this is decided.
 */
export function loginFailureReason(
  user: { password?: string | null } | null | undefined,
  passwordMatches: boolean,
): LoginFailureReason | null {
  if (!user) {
    return 'USER_NOT_FOUND';
  }
  if (!user.password) {
    return 'SOCIAL_LOGIN_ONLY';
  }
  if (!passwordMatches) {
    return 'INVALID_PASSWORD';
  }
  return null;
}
