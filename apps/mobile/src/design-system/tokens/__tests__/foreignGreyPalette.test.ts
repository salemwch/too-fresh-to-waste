/**
 * MD2 - the foreign grey palette must not come back.
 *
 * The app carried 172 uses of Tailwind's slate and gray ramps alongside its own
 * `neutral` scale. 135 were mapped onto the neutral ramp on 2026-08-26. This
 * file is what stops the other ramp reappearing: a value from it is a design
 * decision that belongs in DESIGN.md, not a literal typed into a stylesheet.
 *
 * The two survivors are deliberate and are asserted as such - see BLOCKED below.
 * A test that only forbade the migrated values would let someone "finish the
 * job" and break WCAG AA without anything failing.
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
 * Not migrated, on purpose.
 *
 * Both are secondary text. Their approved target, `neutral[600] #757575`, gives
 * 4.41 against the `*-50` screen background these six files use - below the 4.5
 * AA minimum, where the current values sit at 4.55 and 4.63 and pass. Migrating
 * them would trade a consistency win for an accessibility regression, so they
 * wait on a product decision about which token secondary text should use.
 */
const BLOCKED = ['#64748B', '#6B7280'] as const;

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

  it('contains no Tailwind slate or gray value outside the two blocked ones', () => {
    const offenders = usages.filter(u => !BLOCKED.includes(u.hex as (typeof BLOCKED)[number]));
    expect({
      count: offenders.length,
      where: offenders.map(u => `${u.file}:${u.line} ${u.hex}`),
    }).toEqual({ count: 0, where: [] });
  });

  /*
   * The inverse assertion. Without it, a future pass that migrates the blocked
   * pair - the obvious "we missed some" cleanup - would turn this file green
   * while pushing secondary text below AA on six screens.
   */
  it.each(BLOCKED)('%s is still present, because migrating it would break WCAG AA', hex => {
    expect(usages.some(u => u.hex === hex)).toBe(true);
  });

  it('keeps the blocked pair confined to the count recorded at migration time', () => {
    // 19 + 18 on 2026-08-26. A rise means new code copied the foreign value in.
    const counts = Object.fromEntries(
      BLOCKED.map(hex => [hex, usages.filter(u => u.hex === hex).length]),
    );
    expect(counts).toEqual({ '#64748B': 19, '#6B7280': 18 });
  });
});
