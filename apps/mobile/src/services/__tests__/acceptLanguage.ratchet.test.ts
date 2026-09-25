import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Every request that can show a backend message sends Accept-Language.
 *
 * apiClient sets it for everything that goes through it. Code that calls bare
 * axios has to set it itself, and two places did not: the whole auth service
 * (so every sign-in error came back in English on a French or Arabic phone)
 * and nearbyOffersService. This fails for a new bare-axios file that forgets.
 */

const SRC = join(__dirname, '../..');

/** Bare-axios files whose errors never reach the user, with the reason. */
const NO_USER_FACING_ERRORS = new Set([
  // Device-token register/unregister: failures are logged and swallowed.
  'services/NotificationService.ts',
]);

const BARE_AXIOS_REQUEST = /\baxios(?:\.(?:get|post|put|patch|delete|request))?\(/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec|d)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Accept-Language on bare axios requests', () => {
  const bare = sourceFiles(SRC)
    .map(file => ({
      rel: relative(SRC, file).replace(/\\/g, '/'),
      text: readFileSync(file, 'utf8'),
    }))
    .filter(({ text }) => BARE_AXIOS_REQUEST.test(text));

  it('finds the bare-axios files (the scan itself works)', () => {
    expect(bare.map(f => f.rel)).toEqual(
      expect.arrayContaining(['features/auth/services/authService.ts']),
    );
  });

  it('every one of them sends Accept-Language, or is listed with a reason', () => {
    const missing = bare
      .filter(f => !NO_USER_FACING_ERRORS.has(f.rel))
      .filter(f => !f.text.includes("'Accept-Language'"))
      .map(f => f.rel);

    expect(missing).toEqual([]);
  });
});
