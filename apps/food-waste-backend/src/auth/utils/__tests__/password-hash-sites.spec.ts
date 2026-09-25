/**
 * Every user password is hashed with USER_PASSWORD_HASH_OPTIONS.
 *
 * Login verifies an unknown email against a dummy hash made with those options,
 * so a wrong password and an unknown email cost the same. That only holds if
 * every stored hash has the same cost. Two invite paths called
 * `argon2.hash(password)` with the library defaults (parallelism 4, not 1), so
 * invited admins, moderators and location managers were measurably slower to
 * reject than an unknown email - an existence oracle - and three more sites
 * repeated the numbers inline, where a change to the constant would not reach.
 *
 * Hashes of things that are not user passwords (MFA backup codes, phone
 * verification codes) are listed below with the reason, so a new call site has
 * to be one or the other.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '../../..');

/** `file: first argument` of hash calls that are not user passwords. */
const NOT_A_PASSWORD = new Set([
  'users/services/mfa.service.ts: code', // MFA backup codes
  'users/user.service.ts: verificationCode', // phone verification code
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') {
        sourceFiles(full, out);
      }
      continue;
    }
    if (entry.endsWith('.ts') && !/\.(spec|test|d)\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** `argon2.hash(<first>, <rest>)` - first argument and the rest, as written. */
const HASH_CALL = /argon2\.hash\(\s*([\w.]+)\s*(?:,\s*([^)]*?))?\s*\)/g;

describe('user password hash sites', () => {
  const calls = sourceFiles(SRC).flatMap(file => {
    const rel = relative(SRC, file).replace(/\\/g, '/');
    return [...readFileSync(file, 'utf8').matchAll(HASH_CALL)].map(match => ({
      site: `${rel}: ${match[1] ?? ''}`,
      options: (match[2] ?? '').trim(),
    }));
  });

  it('finds the call sites (the scan itself works)', () => {
    expect(calls.map(c => c.site)).toEqual(
      expect.arrayContaining([
        'users/user.service.ts: createUserDto.password',
        'admin/services/team-management.service.ts: temporaryPassword',
      ]),
    );
  });

  it('hashes every user password with USER_PASSWORD_HASH_OPTIONS', () => {
    const offenders = calls
      .filter(call => !NOT_A_PASSWORD.has(call.site))
      .filter(call => call.options !== 'USER_PASSWORD_HASH_OPTIONS')
      .map(call => `${call.site} (options: ${call.options || 'library defaults'})`);

    expect(offenders).toEqual([]);
  });
});
