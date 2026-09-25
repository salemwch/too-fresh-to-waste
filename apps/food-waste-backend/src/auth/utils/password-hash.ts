import { randomBytes } from 'node:crypto';

import { Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

const logger = new Logger('PasswordHash');

/**
 * How user passwords are hashed: argon2id at the OWASP-recommended cost
 * (64 MiB, 3 passes). One constant so every site that hashes a user password
 * - and the dummy hash below - costs exactly the same.
 * `password-hash-sites.spec.ts` fails for a site that does not use it.
 */
export const USER_PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
} as const;

let dummyHash: Promise<string> | undefined;

/**
 * A hash of a random secret nobody knows, with the same parameters as a real
 * user hash. Login verifies against it when the email is unknown (or the
 * account has no password), so a request for a non-existent account does the
 * same argon2 work as a wrong password on a real one, and response time does
 * not reveal which emails are registered.
 *
 * Created once per process, on first use, and memoised. A failed attempt is
 * not: the next call tries again, rather than every later unknown-email login
 * in this worker failing on the same rejected promise.
 */
export async function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= argon2
    .hash(randomBytes(32).toString('hex'), USER_PASSWORD_HASH_OPTIONS)
    .catch((error: unknown) => {
      dummyHash = undefined;
      throw error;
    });
  const hash = await dummyHash;
  return hash;
}

/**
 * Whether `password` matches the stored hash - for the login path, where the
 * answer must not depend on anything but the password.
 *
 * - No stored hash (unknown email, social-only account): verified against the
 *   dummy hash, so the work is the same, and it never matches.
 * - A stored value argon2 cannot read (legacy, corrupt, empty): `verify`
 *   throws, which used to surface as a 500 for that one account - a status
 *   code no unknown email produces, and so an oracle. It is a mismatch, after
 *   the same dummy work, and it is logged: that account cannot sign in.
 */
export async function verifyUserPassword(
  storedHash: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (!storedHash) {
    const target = await getDummyPasswordHash();
    await argon2.verify(target, password);
    return false;
  }
  try {
    const matches = await argon2.verify(storedHash, password);
    return matches;
  } catch (error) {
    logger.error('Stored password hash could not be verified; treating as a mismatch', {
      error: error instanceof Error ? error.message : String(error),
    });
    const target = await getDummyPasswordHash();
    await argon2.verify(target, password).catch(() => false);
    return false;
  }
}
