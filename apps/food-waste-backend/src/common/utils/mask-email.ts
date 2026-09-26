/**
 * An email address as it may appear in a log line: first character of the
 * local part, then `***`, then the domain - `s***@gmail.com`.
 *
 * Logs outlive the data they describe and are read by more people than the
 * database is, so an address is personal data there (OWASP Logging Cheat
 * Sheet: mask or remove). Where the account is known, log its `userId`
 * instead; this is for the paths that have no account, such as a login for an
 * unknown email. The domain is kept because it is what triage needs (a burst
 * against one provider, a typo domain).
 *
 * Never throws: a malformed value is logged as `***`.
 */
export function maskEmail(email: unknown): string {
  if (typeof email !== 'string') {
    return '***';
  }
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    return '***';
  }
  return `${trimmed[0] ?? ''}***@${trimmed.slice(at + 1).toLowerCase()}`;
}
