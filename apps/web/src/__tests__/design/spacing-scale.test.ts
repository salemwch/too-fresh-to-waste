/**
 * The spacing migration changes what every numeric Tailwind class means at once.
 *
 * `tailwind.config.ts` used to override `theme.spacing` keys 0-10, so `p-4` was
 * 24px and `h-10` was 96px - the default `<Button>` rendered 96px tall and
 * `size="sm"` (80px) was taller than `size="lg"` (44px). Removing that override
 * is correct, but it silently re-values ~3,800 class names, and nothing else we
 * run can see it: these are strings, so type-check and the unit suite pass
 * either way.
 *
 * This is the gate. It resolves every spacing-derived utility in the tree to the
 * pixel it renders at and compares a per-file multiset against a committed
 * baseline, bucketed by migration category:
 *
 *   A  layout spacing  - locked, must render identical pixels
 *   D  positioning     - locked, must render identical pixels
 *   B  icon sizing     - allowed to change; the change is the point
 *   C  box dimensions  - allowed to change; reviewed case by case
 *
 * Regenerate the baseline deliberately, never to make this pass:
 *   pnpm --filter @foodwaste/web check:spacing --write
 */

import resolveConfig from 'tailwindcss/resolveConfig';

import { readSpacingScale, buildSnapshot, compare } from '../../../scripts/spacing-snapshot.mjs';

import baseline from '../../../scripts/spacing-baseline.json';

/** file -> category -> `<prefix>:<px>` -> count */
type Snapshot = Record<string, Record<string, Record<string, number>>>;

describe('the scale is read from the config, not assumed', () => {
  const scale = readSpacingScale() as Record<string, string>;

  it('keeps Tailwind default numeric keys', () => {
    // n * 4px. If an override ever returns, these are the first things to move.
    expect(scale['1']).toBe('0.25rem');
    expect(scale['4']).toBe('1rem');
    expect(scale['10']).toBe('2.5rem');
  });

  it('is monotonic across the integer keys', () => {
    const px = (v: string) =>
      v.endsWith('rem') ? parseFloat(v) * 16 : v === '0' ? 0 : parseFloat(v);
    const integers = Object.keys(scale)
      .filter(k => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b);

    const values = integers.map(k => px(scale[String(k)] as string));
    const sorted = [...values].sort((a, b) => a - b);
    // The old override climbed to 96px at key 10 then collapsed to 44px at 11.
    expect(values).toEqual(sorted);
  });

  it('exposes the named semantic tokens from DESIGN.md §4.1', () => {
    expect(scale.xxs).toBe('2px');
    expect(scale.xs).toBe('4px');
    expect(scale.sm).toBe('8px');
    expect(scale.md).toBe('16px');
    expect(scale.lg).toBe('24px');
    expect(scale.xl).toBe('32px');
    expect(scale['2xl']).toBe('40px');
    expect(scale['6xl']).toBe('96px');
  });

  it('does not let a named token shadow maxWidth', () => {
    // max-w-md must stay 28rem. Adding spacing.md would break 30 call sites if
    // maxWidth spread the spacing scale - it does not, and this proves it.
    const cfg = resolveConfig({
      content: [],
      theme: { extend: { spacing: { md: '16px' } } },
    });
    expect(cfg.theme.maxWidth.md).toBe('28rem');
  });
});

describe('comparison logic', () => {
  it('flags a change in a locked category as drift', () => {
    const { drift, intentional } = compare(
      { 'a.tsx': { A: { 'p:16': 1 } } },
      { 'a.tsx': { A: { 'p:24': 1 } } },
    );
    expect(drift).toHaveLength(2); // p:16 disappeared, p:24 appeared
    expect(intentional).toHaveLength(0);
  });

  it('treats an icon-size change as intentional, not drift', () => {
    const { drift, intentional } = compare(
      { 'a.tsx': { B: { 'size:24': 1 } } },
      { 'a.tsx': { B: { 'size:16': 1 } } },
    );
    expect(drift).toHaveLength(0);
    expect(intentional).toHaveLength(2);
  });

  it('reports nothing when the tree is unchanged', () => {
    const snap = { 'a.tsx': { A: { 'p:16': 2 }, D: { 'top:8': 1 } } };
    expect(compare(snap, snap)).toEqual({ drift: [], intentional: [] });
  });

  it('notices a file that gained or lost utilities entirely', () => {
    const { drift } = compare({}, { 'new.tsx': { A: { 'gap:16': 1 } } });
    expect(drift).toHaveLength(1);
  });
});

describe('the app itself', () => {
  const { snapshot, unresolved } = buildSnapshot();

  it('has files to scan, so this suite is not vacuous', () => {
    expect(Object.keys(snapshot).length).toBeGreaterThan(100);
  });

  it('resolves every spacing utility it finds to a fixed pixel value', () => {
    expect(unresolved).toEqual([]);
  });

  it('renders identical pixels for layout spacing and positioning', () => {
    const { drift } = compare(baseline as Snapshot, snapshot);
    const formatted = drift.map(d => `${d.category} ${d.file} ${d.token} ${d.before}->${d.after}`);
    expect(formatted).toEqual([]);
  });
});
