/**
 * Raw colour budget — a ratchet, not a gate.
 *
 * The app carries hundreds of hardcoded colours that predate the token system.
 * A lint rule would fire on every file and be disabled within a day, so instead
 * this pins the current count as a ceiling: existing debt is tolerated, new debt
 * fails the suite.
 *
 * When you clear some, lower the number. It should only ever go down.
 *
 * Not a substitute for the migration — see docs/plans/design-token-migration.md
 * for the real plan and the design decision it is waiting on.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..', '..');

/**
 * Files allowed to define raw colours: the token scale itself, and the
 * feature palettes that are a feature's single colour source.
 */
const PALETTE_FILES = [
  join('design-system', 'tokens', 'colors.ts'),
  join('features', 'leaderboard', 'constants', 'palette.ts'),
];

/**
 * Current debt, measured 2026-07-27 after converting every semantic colour
 * (brand primary, success, error, warning, info) to its token.
 *
 * Lower this when you clear some. Never raise it.
 */
const MAX_RAW_COLORS = 486;

const HEX_LITERAL = /'#[0-9a-fA-F]{3,8}'/gu;

const isSource = (file: string): boolean =>
  (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts');

const isExempt = (relativePath: string): boolean =>
  relativePath.includes('__tests__') ||
  relativePath.includes('.test.') ||
  PALETTE_FILES.some(palette => relativePath.endsWith(palette));

function collect(dir: string, out: Map<string, number>, base = ''): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const relative = join(base, entry);

    if (statSync(full).isDirectory()) {
      collect(full, out, relative);
      continue;
    }
    if (!isSource(entry) || isExempt(relative)) continue;

    const matches = readFileSync(full, 'utf8').match(HEX_LITERAL);
    if (matches != null) out.set(relative, matches.length);
  }
}

describe('raw colour budget', () => {
  const counts = new Map<string, number>();
  collect(SRC, counts);
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  it(`stays at or below ${MAX_RAW_COLORS} raw colours outside palette files`, () => {
    // Fails on the way up, and on the way down once you forget to lower it.
    expect(total).toBeLessThanOrEqual(MAX_RAW_COLORS);
  });

  // Otherwise the ceiling drifts upward invisibly as debt is paid elsewhere.
  it('has its ceiling kept in step with reality', () => {
    expect(MAX_RAW_COLORS - total).toBeLessThan(25);
  });

  it('finds source files to measure, so a broken walk cannot pass silently', () => {
    expect(counts.size).toBeGreaterThan(10);
  });

  // The palette files are the intended home for raw values; if the exemption
  // stopped matching them they would be counted and the budget would jump.
  it('exempts the palette files it means to', () => {
    for (const palette of PALETTE_FILES) {
      expect([...counts.keys()].some(file => file.endsWith(palette))).toBe(false);
    }
  });
});
