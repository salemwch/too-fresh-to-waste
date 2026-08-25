/**
 * The spacing scale, and the MD1 migration that added its two numeric sub-steps.
 *
 * MD1 (MOBILE_DESIGN_DECISION_BRIEF.md) added 12px and 20px to the scale rather
 * than migrating their 297 usages to 16/24. The whole argument for that option
 * was that **nothing renders differently** - so the migration is only correct if
 * the token holds exactly the value the literal held. That is what the first
 * block below pins, and it is the reason this file exists at all.
 *
 * The named scale is pinned too. It is shared with web (DESIGN.md 4.1 states the
 * two must match exactly), and a silent drift on either side is invisible until
 * a designer measures a screenshot.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { spacingTokens } from '../spacing';

const scale = spacingTokens.base as Record<string, number>;

/* ------------------------------------------------------------ the scale ---- */

describe('the named scale', () => {
  /*
   * DESIGN.md 4.1 is the contract and it is shared with apps/web's
   * tailwind.config.ts. Changing a value here without changing it there splits
   * the rhythm between platforms.
   */
  const NAMED: ReadonlyArray<readonly [string, number]> = [
    ['xxs', 2],
    ['xs', 4],
    ['sm', 8],
    ['md', 16],
    ['lg', 24],
    ['xl', 32],
    ['2xl', 40],
    ['3xl', 48],
    ['4xl', 64],
    ['5xl', 80],
    ['6xl', 96],
  ];

  it.each(NAMED)('%s is %ipx', (token, value) => {
    expect(scale[token]).toBe(value);
  });

  it('was not disturbed by adding the sub-steps', () => {
    // MD1 must be additive. If a named token moved, the "no visual drift"
    // claim is false for far more than 297 call sites.
    expect(NAMED.every(([token, value]) => scale[token] === value)).toBe(true);
  });
});

describe('the MD1 numeric sub-steps', () => {
  /*
   * These are the exact values the migrated literals used to carry. Asserted as
   * the literal number, not as `SPACING_UNIT * 1.5`, so that a change to the
   * base unit fails here instead of silently rescaling 297 call sites.
   */
  it('sp[3] is 12px - the value its 210 literals used to carry', () => {
    expect(scale['3']).toBe(12);
  });

  it('sp[5] is 20px - the value its 87 literals used to carry', () => {
    expect(scale['5']).toBe(20);
  });

  it('means the same as the web numeric key of the same name (n x 4px)', () => {
    // DESIGN.md 4.2: mobile sp[3] and web p-3 are both 12px. This is the whole
    // reason numeric keys were chosen over inventing `smd`/`mlg` names.
    expect(scale['3']).toBe(3 * 4);
    expect(scale['5']).toBe(5 * 4);
  });

  it('sits between the named tokens it subdivides', () => {
    expect(scale['3']).toBeGreaterThan(scale['sm'] as number);
    expect(scale['3']).toBeLessThan(scale['md'] as number);
    expect(scale['5']).toBeGreaterThan(scale['md'] as number);
    expect(scale['5']).toBeLessThan(scale['lg'] as number);
  });

  it('introduces no duplicate value, so every literal has one unambiguous token', () => {
    const values = Object.values(scale);
    expect(new Set(values).size).toBe(values.length);
  });
});

/* --------------------------------------------------- migration completeness -- */

/**
 * The migration is only finished when the literals are gone. Counting them here
 * rather than trusting the codemod's own report: the codemod is the thing under
 * test, and a codemod that silently skipped a file would otherwise pass.
 */

const SRC = join(__dirname, '..', '..', '..');

/**
 * Files allowed to keep a raw 12 or 20 in a padding/margin position.
 *
 * `spacing.ts` defines the scale, so it necessarily contains the numbers.
 * Test files assert against concrete values on purpose - a test that read the
 * token would pass no matter what the token became.
 */
const isExempt = (relativePath: string): boolean =>
  relativePath.includes('__tests__') ||
  relativePath.includes('.test.') ||
  relativePath.endsWith(join('design-system', 'tokens', 'spacing.ts'));

/**
 * `gap` is included deliberately. The decision brief measured `padding`/`margin`
 * only and so reported 297 usages; adding the gap properties brings the real
 * figure to 323. Leaving them out would have let `gap: 12` keep spreading while
 * the suite claimed the migration was complete.
 */
const SPACING_LITERAL =
  /\b((?:padding|margin)(?:Top|Bottom|Left|Right|Start|End|Horizontal|Vertical)?|gap|rowGap|columnGap)\s*:\s*(12|20)(?![\d.])/gu;

const isSource = (file: string): boolean =>
  (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts');

function collect(dir: string, out: Map<string, number>, base = ''): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const relative = join(base, entry);

    if (statSync(full).isDirectory()) {
      if (entry !== '__snapshots__') collect(full, out, relative);
      continue;
    }
    if (!isSource(entry) || isExempt(relative)) continue;

    const matches = readFileSync(full, 'utf8').match(SPACING_LITERAL);
    if (matches != null) out.set(relative, matches.length);
  }
}

describe('MD1 migration completeness', () => {
  const counts = new Map<string, number>();
  collect(SRC, counts);
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  it('leaves no raw 12px or 20px padding, margin or gap literal in source', () => {
    // Reported with the offending files, because "expected 0, got 7" sends the
    // next reader hunting through 800 files.
    expect({ total, files: Object.fromEntries(counts) }).toEqual({ total: 0, files: {} });
  });

  it('actually walked the source tree, so a broken walk cannot pass silently', () => {
    // Without this, a bad SRC path yields zero matches and a green run.
    let sourceFiles = 0;
    const countSources = (dir: string, base = ''): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== '__snapshots__') countSources(full, join(base, entry));
        } else if (isSource(entry)) sourceFiles += 1;
      }
    };
    countSources(SRC);
    expect(sourceFiles).toBeGreaterThan(100);
  });
});
