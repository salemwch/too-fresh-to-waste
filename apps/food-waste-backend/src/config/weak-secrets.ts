/**
 * Rejects known development secrets, not merely short ones.
 *
 * `JWT_SECRET` was validated with `Joi.string().min(32)` alone. The value
 * shipped in docker-compose.yml, `dev_jwt_secret_please_change_in_production`,
 * is 42 characters, so it passed. The one gate that would have caught a
 * copy-paste into production accepted the exact string it needed to reject.
 *
 * Length is a proxy for entropy and a bad one. A secret that appears in a
 * public repository has zero entropy at any length.
 */

/**
 * Literals that have appeared in this repository's committed configuration.
 * Compared case-insensitively after trimming.
 */
export const KNOWN_DEV_SECRETS: readonly string[] = [
  'dev_jwt_secret_please_change_in_production',
  'dev_jwt_refresh_secret_please_change_in_production',
  'foodwaste_password',
  'password123',
  'rabbitmq_dev_password',
  'redis_dev_password',
  'admin123',
];

/**
 * Substrings that mark a value as a placeholder rather than a secret.
 *
 * Safe against false positives on real secrets: a `randomBytes().toString('hex')`
 * value is drawn from `[0-9a-f]`, which cannot spell any of these, and a
 * base64url value spelling one by chance is vanishingly unlikely.
 */
export const PLACEHOLDER_MARKERS: readonly string[] = [
  'change_me',
  'changeme',
  'change-me',
  'please_change',
  'please-change',
  'placeholder',
  'your_secret',
  'your-secret',
  'insecure',
  'notasecret',
  'example',
  'xxxxxxxx',
];

/**
 * Returns a human-readable reason when `value` is unfit to be a secret, or
 * `null` when it is acceptable. Reasons never echo the value itself.
 */
export function describeWeakSecret(value: string): string | null {
  const normalised = value.trim().toLowerCase();

  if (normalised.length === 0) {
    return 'is empty';
  }

  if (KNOWN_DEV_SECRETS.includes(normalised)) {
    return 'is a known development secret committed to this repository; generate a fresh one';
  }

  const marker = PLACEHOLDER_MARKERS.find(m => normalised.includes(m));
  if (marker !== undefined) {
    return `looks like an unreplaced placeholder (contains "${marker}")`;
  }

  // A single repeated character passes a length check but carries no entropy.
  if (new Set(normalised).size <= 4) {
    return 'has too few distinct characters to be random';
  }

  return null;
}
