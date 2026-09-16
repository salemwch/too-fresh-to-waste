/**
 * M16-a - `neutral[500]` may only be used where WCAG does not apply.
 *
 * THE FINDING
 * -----------
 * `neutral[500]` is `#9E9E9E`. Against the four light surfaces the system
 * defines it measures 2.31-2.68, where AA wants 4.5 for text and 1.4.11 wants
 * 3.0 for a graphic that identifies a control. It was carrying 39 usages: body
 * and secondary text, three input placeholders, and ten icons - including the
 * establishment line on `OrderCard`, which is the most-seen card in the app,
 * and the search placeholder on Home.
 *
 * Twenty-nine of those moved to `onSurfaceVariant`, which is `neutral[700]`
 * in the light theme and measures 5.34-6.19.
 *
 * WHY TEN STAYED
 * --------------
 * WCAG 1.4.3 exempts "inactive user interface components" from the contrast
 * minimum, and the ten below are exactly that - a disabled button label in
 * eight variants, a disabled button fill, and a disabled payment-option label.
 * Darkening them would work against the affordance: a disabled control is
 * *supposed* to recede.
 *
 * That exemption is about a contrast obligation, not about whether the result
 * is pleasant to look at. The audit's own words on these were "exempt from AA,
 * but unreadable in practice", and that judgement has not been re-made here.
 * It is recorded in the light-mode remediation report as an open design
 * question rather than settled by this file.
 *
 * WHAT THIS GATE IS FOR
 * ---------------------
 * The 29 sites were mechanical to move and would be just as mechanical to
 * reintroduce - `neutral[500]` reads like a reasonable grey when you are
 * looking for one. This pins the exemption list so a new usage has to be
 * argued for here rather than typed into a stylesheet.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..', '..');

/**
 * The only files allowed to read `neutral[500]`, with the number of usages each
 * is allowed. The count matters as much as the file: without it, a file on this
 * list could grow a new text usage and the gate would not notice.
 */
const DISABLED_CONTROL_EXEMPTIONS: ReadonlyArray<readonly [string, number]> = [
  // The eight `Button` variants' disabled label colour.
  [join('design-system', 'components', 'atoms', 'Button', 'Button.styles.ts'), 8],
  // `DISABLED`, used once as the fill of the disabled Verify button.
  [join('features', 'orders', 'components', 'PhoneVerificationModal.tsx'), 1],
  // `TEXT_DISABLED`, used once for `paymentCardLabelDisabled`.
];

const isSource = (name: string): boolean => /\.(?:ts|tsx)$/u.test(name);

const isExempt = (rel: string): boolean =>
  rel.includes('__tests__') ||
  rel.includes('.test.') ||
  rel.includes('test-utils') ||
  // The token module is where the value is *defined*; the rule is about reads.
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
}

const collect = (): Usage[] => {
  const found: Usage[] = [];
  for (const file of sourceFiles(SRC)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/neutral\[500\]/u.test(line)) {
          found.push({ file: file.slice(SRC.length + 1), line: i + 1 });
        }
      });
  }
  return found;
};

describe('neutral[500] role adoption (M16-a)', () => {
  const usages = collect();
  const allowed = new Map(DISABLED_CONTROL_EXEMPTIONS.map(([f, n]) => [f, n]));

  it('walks a non-empty set of source files, so a broken walk cannot pass', () => {
    // Without this the whole suite passes vacuously if `sourceFiles` ever
    // returns nothing - which is how the visual matrix silently captured
    // nothing for 48 baselines in phase 3.
    expect(sourceFiles(SRC).length).toBeGreaterThan(200);
  });

  it('is read only by files on the disabled-control exemption list', () => {
    const offenders = usages.filter(u => !allowed.has(u.file));
    expect(
      offenders.map(u => `${u.file}:${u.line}`),
      // A new usage here is a contrast decision. If the element really is an
      // inactive control, add it above with its count and say so.
    ).toEqual([]);
  });

  it('holds each exempt file to the exact number of usages it was granted', () => {
    const actual = new Map<string, number>();
    for (const u of usages) actual.set(u.file, (actual.get(u.file) ?? 0) + 1);

    const drift = [...allowed.entries()]
      .filter(([file, n]) => (actual.get(file) ?? 0) !== n)
      .map(([file, n]) => `${file}: allowed ${n}, found ${actual.get(file) ?? 0}`);

    expect(drift).toEqual([]);
  });

  it('lists no exemption that has already been removed from the source', () => {
    // Keeps the list honest in the other direction: a stale entry would quietly
    // license a usage nobody has looked at since it was deleted.
    const present = new Set(usages.map(u => u.file));
    expect([...allowed.keys()].filter(f => !present.has(f))).toEqual([]);
  });
});
