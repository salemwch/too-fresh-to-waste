/**
 * MD2 - the foreign grey palette must not come back.
 *
 * The app carried 172 uses of Tailwind's slate and gray ramps alongside its own
 * `neutral` scale. 135 were mapped onto the neutral ramp on 2026-08-26. This
 * file is what stops the other ramp reappearing: a value from it is a design
 * decision that belongs in DESIGN.md, not a literal typed into a stylesheet.
 *
 * RESOLVED 2026-08-26. The migration is now complete: all 172 uses are gone.
 *
 * The two that were held back - #64748B and #6B7280 - were blocked because
 * their nearest token, neutral[600], gave 4.41 against the *-50 screen
 * background and failed AA. Phase 6.1 moved light `onSurfaceVariant` to
 * neutral[700] for the same reason, and these 37 uses followed it there: 5.92
 * on that background, against 4.55 and 4.62 before. The BLOCKED list is empty
 * and this file now forbids the whole ramp without exception.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..', '..');

/** Tailwind v3 slate + gray - the two ramps the audit identified as foreign. */
const TAILWIND_GREYS = [
  '#F8FAFC',
  '#F1F5F9',
  '#E2E8F0',
  '#CBD5E1',
  '#94A3B8',
  '#64748B',
  '#475569',
  '#334155',
  '#1E293B',
  '#0F172A',
  '#F9FAFB',
  '#F3F4F6',
  '#E5E7EB',
  '#D1D5DB',
  '#9CA3AF',
  '#6B7280',
  '#4B5563',
  '#374151',
  '#1F2937',
  '#111827',
] as const;

/**
 * Empty since 2026-08-26.
 *
 * Kept as a named, empty list rather than deleted: it is the seam where an
 * exception would go, and the two assertions below are written against it. If a
 * value ever has to be held back again, adding it here is the whole change.
 */
const BLOCKED: readonly string[] = [];

const isSource = (f: string): boolean =>
  (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts');

const isExempt = (rel: string): boolean =>
  rel.includes('__tests__') ||
  rel.includes('.test.') ||
  rel.includes('test-utils') ||
  rel.startsWith(join('design-system', 'tokens'));

function sourceFiles(dir: string, base = '', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = join(base, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, rel, out);
      continue;
    }
    if (isSource(entry) && !isExempt(rel)) out.push(full);
  }
  return out;
}

interface Usage {
  file: string;
  line: number;
  hex: string;
}

const collect = (): Usage[] => {
  const found: Usage[] = [];
  const pattern = new RegExp(TAILWIND_GREYS.join('|'), 'giu');
  for (const file of sourceFiles(SRC)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(pattern)) {
          found.push({ file: file.slice(SRC.length + 1), line: i + 1, hex: m[0].toUpperCase() });
        }
      });
  }
  return found;
};

describe('foreign grey palette (MD2)', () => {
  const usages = collect();

  it('finds source files to measure, so a broken walk cannot pass silently', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(100);
  });

  it('contains no Tailwind slate or gray value at all', () => {
    const offenders = usages.filter(u => !BLOCKED.includes(u.hex));
    expect({
      count: offenders.length,
      where: offenders.map(u => `${u.file}:${u.line} ${u.hex}`),
    }).toEqual({ count: 0, where: [] });
  });

  /*
   * Guards the exception seam itself. If BLOCKED is ever repopulated, the entry
   * has to be justified in this file - and a value listed there but no longer
   * in the source is a stale exception, which is how a documented deviation
   * quietly becomes a lie.
   */
  it('lists no exception that has already been removed from the source', () => {
    // A value listed as a deliberate exception but absent from the code is a
    // stale exception, which is how a documented deviation quietly becomes a
    // lie. Written as a loop rather than it.each because the list is empty and
    // it.each rejects an empty table.
    const stale = BLOCKED.filter(hex => !usages.some(u => u.hex === hex));
    expect(stale).toEqual([]);
  });

  it('has no exceptions left', () => {
    expect(BLOCKED).toEqual([]);
  });
});
