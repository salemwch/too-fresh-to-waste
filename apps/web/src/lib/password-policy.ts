import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, buildPasswordRegex } from '@foodwaste/shared';

/**
 * Whether a new password meets the shared policy - the same constants the
 * backend DTOs validate against, so the form never accepts what the server
 * will reject. The change-password forms each had their own rule (one 8+
 * regex, one `minLength={8}`, one nothing), all weaker than the server's 12.
 */
export function meetsPasswordPolicy(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    buildPasswordRegex().test(password)
  );
}

export { PASSWORD_MIN_LENGTH };
