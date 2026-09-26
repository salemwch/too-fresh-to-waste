/**
 * The error catalogue - integrity of the three languages.
 *
 * Completeness of fr / ar is compiler-checked (`Record<ErrorCode, string>`).
 * What the compiler cannot see is checked here: placeholders must match, or a
 * French user sees a literal "{maxDays}"; and copy rules that hold across the
 * product (no em dash, no raw developer text).
 */

import { AR } from '../catalog/ar';
import { EN, type ErrorCode } from '../catalog/en';
import { FR } from '../catalog/fr';

const CODES = Object.keys(EN) as ErrorCode[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('error catalogue', () => {
  it('has codes in SCREAMING_SNAKE_CASE, the shape clients match on', () => {
    for (const code of CODES) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it.each(['fr', 'ar'] as const)('%s uses exactly the placeholders English does', lng => {
    const table = lng === 'fr' ? FR : AR;
    const mismatched = CODES.filter(
      code => placeholders(EN[code]).join() !== placeholders(table[code]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('has no empty translation', () => {
    const empty = CODES.filter(code => !EN[code].trim() || !FR[code].trim() || !AR[code].trim());
    expect(empty).toEqual([]);
  });

  it('contains no em dash, in any language (house style)', () => {
    const withDash = CODES.filter(code =>
      [EN[code], FR[code], AR[code]].some(text => text.includes('—')),
    );
    expect(withDash).toEqual([]);
  });

  it('exposes no developer vocabulary to users', () => {
    // The texts that replaced messages like "Use ISO 8601 format" or
    // "missing JTI". A new entry using these words is almost certainly wrong.
    const JARGON = /\b(ISO ?8601|JTI|ObjectId|MIME|payload|null|undefined|E\.164|DTO|stub)\b/i;
    expect(CODES.filter(code => JARGON.test(EN[code]))).toEqual([]);
  });
});
