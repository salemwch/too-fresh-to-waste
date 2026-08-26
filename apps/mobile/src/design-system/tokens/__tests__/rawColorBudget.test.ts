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
 * Current debt.
 *
 * 2026-07-27: 488, after converting every semantic colour (brand primary,
 * success, error, warning, info) to its token.
 * 2026-08-26: 354, after MD2 mapped 135 foreign slate/gray literals onto the
 * neutral ramp. The drop is 134 rather than 135 because this regex only counts
 * single-quoted literals and one migrated usage was a double-quoted JSX
 * attribute.
 * 2026-08-26 (Phase 6.1): 316, after the last 37 - #64748B and #6B7280 - moved
 * to neutral[700]. They had been held back because neutral[600] failed AA on
 * the *-50 screen background; moving light onSurfaceVariant to neutral[700]
 * for the same reason gave them a passing target (5.92, from 4.55/4.62).
 *
 * Lower this when you clear some. Never raise it.
 */
const MAX_RAW_COLORS = 316;

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
